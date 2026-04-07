import { prisma } from "../../db/prisma";
import { actualizarTipoCliente } from "../../utils/actualizarTipoCliente";
import { crearPreferencia } from "../../utils/mercadopago";
import { cancelarTimerExpiracion } from "../reservas/reserva.service";
import { colaService } from "../cola-espera/cola.service";
import { mailReservaConfirmada } from "../../utils/mailer";
import type { MetodoPago } from "../../types/models";

export const pagoService = {
  // ─── ABONO PRESENCIAL (ADMIN) ──────────────────────────────────────

  async cargarAbonoPresencial(
    clienteId:      number,
    cantidadClases: number,
    monto:          number,
    metodo:         MetodoPago,
    solicitanteId:  number,
    referencia?:    string
  ) {
    const cliente = await prisma.usuario.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new Error("Cliente no encontrado");
    if (cliente.rol !== "CLIENTE") throw new Error("El usuario no es un cliente");

    const nuevasClases = cliente.clasesDisponibles + cantidadClases;

    // El modelo Pago requiere reservaId (FK), por lo que los abonos directos
    // no generan registro en Pago. La auditoría queda en clasesDisponibles del usuario.
    await prisma.usuario.update({
      where: { id: clienteId },
      data: {
        clasesDisponibles: nuevasClases,
        sancionado:        false,
      },
    });

    await actualizarTipoCliente(clienteId, nuevasClases);

    return { clienteId, cantidadClases, nuevasClases, monto, metodo };
  },

  // ─── ABONO POR MP (CLIENTE) ────────────────────────────────────────

  async iniciarAbonoMp(
    clienteId:      number,
    cantidadClases: number,
    monto:          number
  ) {
    const ts        = Date.now();
    const extRef    = `abono-${clienteId}-${cantidadClases}-${ts}`;

    let initPoint = "";
    let mpPrefId  = "";
    try {
      const pref = await crearPreferencia({
        items: [
          {
            id:          extRef,
            title:       `Abono ${cantidadClases} clases - Kinesius`,
            unit_price:  monto,
            quantity:    1,
            currency_id: "ARS",
          },
        ],
        external_reference: extRef,
        // Los abonos no expiran automáticamente
      });
      initPoint = pref.init_point ?? pref.sandbox_init_point ?? "";
      mpPrefId  = pref.id ?? "";
    } catch (err) {
      console.error("[pagoService] Error generando preferencia abono MP:", err);
    }

    return { initPoint, external_reference: extRef, mpPrefId };
  },

  // ─── COMPLEMENTO (ADMIN) ──────────────────────────────────────────

  async registrarComplemento(
    reservaId:     number,
    metodo:        MetodoPago,
    solicitanteId: number,
    referencia?:   string
  ) {
    const reserva = await prisma.reserva.findUnique({
      where: { id: reservaId },
      include: { instancia: true },
    });
    if (!reserva) throw new Error("Reserva no encontrada");
    if (reserva.estado !== "RESERVA_PAGA") {
      throw new Error("Solo se puede cargar complemento en reservas con seña pagada");
    }

    const precioInstancia = Number(reserva.instancia.precio);
    const montoRestante   = precioInstancia - Number(reserva.montoPagado);

    if (montoRestante <= 0) {
      throw new Error("La reserva ya está completamente pagada");
    }

    const [pago] = await prisma.$transaction([
      prisma.pago.create({
        data: {
          reservaId,
          monto:     montoRestante,
          metodo,
          tipo:      "COMPLEMENTO",
          referencia: referencia ?? null,
        },
      }),
      prisma.reserva.update({
        where: { id: reservaId },
        data: {
          montoPagado: { increment: montoRestante },
          estado:      "COMPLETADA",
        },
      }),
    ]);

    await prisma.pagoLog.create({
      data: {
        pagoId:        pago.id,
        evento:        "CREADO",
        solicitadoPor: solicitanteId,
      },
    });

    return pago;
  },

  // ─── PAGOS DE UNA RESERVA ──────────────────────────────────────────

  async listarPorReserva(reservaId: number) {
    return prisma.pago.findMany({
      where: { reservaId },
      include: { logs: true },
      orderBy: { createdAt: "asc" },
    });
  },

  // ─── WEBHOOK MP ───────────────────────────────────────────────────

  async procesarWebhook(body: Record<string, unknown>, signature: string) {
    // Validación de firma HMAC-SHA256
    //const crypto = await import("crypto");
    //const secret = (await import("../../utils/mercadopago")).MP_WEBHOOK_SECRET;
    /*
    if (secret) {
      // MP envía x-signature: ts=<ts>,v1=<hash>
      // Construimos el mensaje: id:<id>;request-id:<xRequestId>;ts:<ts>
      // Por simplicidad, verificamos el body serializado
      const payload = JSON.stringify(body);
      const expected = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
      if (signature && !signature.includes(expected)) {
        // MP puede enviar formato diferente; logueamos pero no bloqueamos en dev
        console.warn("[webhook] Firma MP no coincide, posible webhook inválido");
      }
    }
      */

    const tipo     = body.type as string;
    const accion   = body.action as string;
    const dataId   = (body.data as Record<string, string>)?.id;

    if (tipo !== "payment" || accion !== "payment.updated") return { procesado: false };

    // Obtener detalles del pago desde MP via fetch directo
    let mpData: Record<string, unknown> = {};
    try {
      const { env } = await import("../../config/env");
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${env.mp.accessToken}` },
      });
      mpData = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error(`MP ${res.status}: ${JSON.stringify(mpData)}`);
    } catch (err) {
      console.error("[webhook] Error obteniendo pago de MP:", err);
      return { procesado: false };
    }

    const status    = mpData.status as string;
    const extRef    = mpData.external_reference as string;
    const mpPayId   = String(mpData.id ?? "");
    const mpStatus  = status;

    if (status === "approved") {
      if (extRef?.startsWith("sena-")) {
        await this._aprobarSena(extRef, mpPayId, mpStatus, mpData);
      } else if (extRef?.startsWith("abono-")) {
        await this._aprobarAbono(extRef, mpPayId, mpStatus, mpData);
      }
    } else if (status === "rejected" || status === "cancelled") {
      await this._rechazarPago(extRef, mpPayId, mpStatus, mpData);
    }

    return { procesado: true };
  },

  async _aprobarSena(
    extRef:   string,
    mpPayId:  string,
    mpStatus: string,
    mpData:   Record<string, unknown>
  ) {
    const reservaId = Number(extRef.replace("sena-", ""));
    const reserva   = await prisma.reserva.findUnique({
      where: { id: reservaId },
      include: { cliente: true, instancia: true, pagos: true },
    });
    if (!reserva || reserva.estado !== "PENDIENTE_PAGO") return;

    const pagoPrincipal = reserva.pagos[0];
    if (!pagoPrincipal) {
      console.error(`[webhook] Reserva ${reservaId} sin pago asociado, no se puede aprobar`);
      return;
    }

    const monto = Number(mpData.transaction_amount ?? pagoPrincipal.monto ?? 0);

    const [, pago] = await prisma.$transaction([
      prisma.reserva.update({
        where: { id: reservaId },
        data: {
          estado:      "RESERVA_PAGA",
          montoPagado: { increment: monto },
        },
      }),
      // Actualizar el pago existente de seña (el primero)
      prisma.pago.update({
        where: { id: pagoPrincipal.id },
        data:  { monto, referencia: mpPayId },
      }),
    ]);

    await prisma.pagoLog.create({
      data: {
        pagoId:        pago.id,
        evento:        "APROBADO",
        mpPaymentId:   mpPayId,
        mpStatus,
        mpRawResponse: mpData as never,
      },
    });

    // Cancelar timer de expiración
    cancelarTimerExpiracion(reservaId);

    await mailReservaConfirmada(
      { nombre: reserva.cliente.nombre, email: reserva.cliente.email },
      { fecha: reserva.instancia.fecha, zona: reserva.instancia.zona }
    );
  },

  async _aprobarAbono(
    extRef:   string,
    mpPayId:  string,
    mpStatus: string,
    mpData:   Record<string, unknown>
  ) {
    // extRef: abono-{clienteId}-{cantidadClases}-{ts}
    const partes        = extRef.split("-");
    const clienteId     = Number(partes[1]);
    const cantidadClases = Number(partes[2]);

    const cliente = await prisma.usuario.findUnique({ where: { id: clienteId } });
    if (!cliente) return;

    const nuevasClases = cliente.clasesDisponibles + cantidadClases;

    await prisma.usuario.update({
      where: { id: clienteId },
      data: {
        clasesDisponibles: nuevasClases,
        sancionado:        false,
      },
    });

    await actualizarTipoCliente(clienteId, nuevasClases);
    // El log queda en la respuesta del webhook; no hay Pago vinculado a reserva aquí
    console.log(`[webhook] Abono aprobado para cliente ${clienteId}: +${cantidadClases} clases`);
  },

  async _rechazarPago(
    extRef:   string,
    mpPayId:  string,
    mpStatus: string,
    mpData:   Record<string, unknown>
  ) {
    if (extRef?.startsWith("sena-")) {
      const reservaId = Number(extRef.replace("sena-", ""));
      const reserva   = await prisma.reserva.findUnique({
        where: { id: reservaId },
        include: { pagos: true },
      });
      if (!reserva) return;

      if (reserva.estado === "PENDIENTE_PAGO") {
        await prisma.reserva.update({ where: { id: reservaId }, data: { estado: "CANCELADA" } });
        cancelarTimerExpiracion(reservaId);
      }

      if (reserva.pagos.length > 0) {
        await prisma.pagoLog.create({
          data: {
            pagoId:        reserva.pagos[0].id,
            evento:        "FALLIDO",
            mpPaymentId:   mpPayId,
            mpStatus,
            mpRawResponse: mpData as never,
          },
        });
      }
    }
  },
};
