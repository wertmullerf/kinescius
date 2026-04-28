import { prisma } from "../../db/prisma";
import { actualizarTipoCliente } from "../../utils/actualizarTipoCliente";
import {
  crearPreferencia,
  obtenerPago,
  paymentToLog,
  type PaymentResponse,
} from "../../utils/mercadopago";
import { colaService } from "../cola-espera/cola.service";
import { mailReservaConfirmada } from "../../utils/mailer";
import type { MetodoPago } from "../../types/models";

export const pagoService = {

  // ─── ABONO PRESENCIAL (ADMIN) ──────────────────────────────────────────────
  // El admin registra manualmente un abono de un cliente (efectivo / transferencia).
  // No genera reserva; solo incrementa clasesDisponibles.

  async cargarAbonoPresencial(
    clienteId:      number,
    cantidadClases: number,
    monto:          number,
    metodo:         MetodoPago,
    solicitanteId:  number,
    referencia?:    string
  ) {
    const cliente = await prisma.usuario.findUnique({ where: { id: clienteId } });
    if (!cliente)                  throw new Error("Cliente no encontrado");
    if (cliente.rol !== "CLIENTE") throw new Error("El usuario no es un cliente");

    const [updatedUser, pagoAbono] = await prisma.$transaction([
      prisma.usuario.update({
        where: { id: clienteId },
        data:  { clasesDisponibles: { increment: cantidadClases }, sancionado: false },
      }),
      prisma.pagoAbono.create({
        data: {
          clienteId,
          cantidadClases,
          monto,
          metodo,
          referencia: referencia ?? null,
        },
        include: { cliente: { select: { id: true, nombre: true, apellido: true, email: true } } },
      }),
    ]);

    await actualizarTipoCliente(clienteId, updatedUser.clasesDisponibles);

    return pagoAbono;
  },

  // ─── ABONO POR MP (CLIENTE) ───────────────────────────────────────────────
  // Genera una preferencia de Checkout Pro y retorna el init_point.
  // El acreditado de clases lo hace el webhook cuando MP confirma el pago.

  async iniciarAbonoMp(clienteId: number, cantidadClases: number, monto: number) {
    const extRef = `abono-${clienteId}-${cantidadClases}-${Date.now()}`;

    const pref = await crearPreferencia({
      items: [
        {
          id:          extRef,
          title:       `Abono ${cantidadClases} clases - Kinescius`,
          unit_price:  monto,
          quantity:    1,
          currency_id: "ARS",
        },
      ],
      external_reference: extRef,
    });

    return {
      initPoint:          pref.init_point,
      external_reference: extRef,
      mpPrefId:           pref.id,
    };
  },

  // ─── COMPLEMENTO (ADMIN) ──────────────────────────────────────────────────
  // El admin registra el saldo restante que el cliente paga presencialmente.
  // Solo aplica a reservas en estado RESERVA_PAGA.

  async registrarComplemento(
    reservaId:     number,
    metodo:        MetodoPago,
    solicitanteId: number,
    referencia?:   string
  ) {
    const reserva = await prisma.reserva.findUnique({
      where:   { id: reservaId },
      include: { instancia: true },
    });
    if (!reserva) throw new Error("Reserva no encontrada");
    if (reserva.estado !== "RESERVA_PAGA") {
      throw new Error("Solo se puede cargar complemento en reservas con seña pagada");
    }

    const montoRestante = Number(reserva.instancia.precio) - Number(reserva.montoPagado);
    if (montoRestante <= 0) throw new Error("La reserva ya está completamente pagada");

    const [pago] = await prisma.$transaction([
      prisma.pago.create({
        data: {
          reservaId,
          monto:      montoRestante,
          metodo,
          tipo:       "COMPLEMENTO",
          referencia: referencia ?? null,
        },
      }),
      prisma.reserva.update({
        where: { id: reservaId },
        data:  { montoPagado: { increment: montoRestante }, estado: "COMPLETADA" },
      }),
    ]);

    await prisma.pagoLog.create({
      data: { pagoId: pago.id, evento: "CREADO", solicitadoPor: solicitanteId },
    });

    return pago;
  },

  // ─── LISTAR ABONOS (ADMIN) ────────────────────────────────────────────────

  async listarAbonos(q?: string) {
    return prisma.pagoAbono.findMany({
      where: q
        ? {
            cliente: {
              OR: [
                { nombre:   { contains: q, mode: "insensitive" } },
                { apellido: { contains: q, mode: "insensitive" } },
                { email:    { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : undefined,
      include: { cliente: { select: { id: true, nombre: true, apellido: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  // ─── LISTAR PAGOS DE RESERVAS (ADMIN) ────────────────────────────────────

  async listarPagosReserva(q?: string) {
    return prisma.pago.findMany({
      where: q
        ? {
            reserva: {
              cliente: {
                OR: [
                  { nombre:   { contains: q, mode: "insensitive" } },
                  { apellido: { contains: q, mode: "insensitive" } },
                  { email:    { contains: q, mode: "insensitive" } },
                ],
              },
            },
          }
        : undefined,
      include: {
        reserva: {
          include: {
            cliente:   { select: { id: true, nombre: true, apellido: true, email: true } },
            instancia: { select: { fecha: true, zona: true } },
          },
        },
        logs: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  // ─── LISTAR ABONOS POR CLIENTE ────────────────────────────────────────────

  async listarAbonosPorCliente(clienteId: number) {
    return prisma.pagoAbono.findMany({
      where:   { clienteId },
      orderBy: { createdAt: "desc" },
    });
  },

  // ─── PAGOS DE UNA RESERVA ─────────────────────────────────────────────────

  async listarPorReserva(reservaId: number) {
    return prisma.pago.findMany({
      where:   { reservaId },
      include: { logs: true },
      orderBy: { createdAt: "asc" },
    });
  },

  // ─── WEBHOOK DE MERCADO PAGO ──────────────────────────────────────────────
  // Endpoint público (sin auth). MP reintenta si no recibe HTTP 200.
  //
  // POST: { type: "payment", action: "payment.created|updated", data: { id: "..." } }
  // GET/IPN: query params ?topic=payment&id=PAYMENT_ID

  async procesarWebhookPost(body: Record<string, string | object>) {
    if (body["type"] !== "payment" || !body["data"]) return { procesado: false };
    const accion = body["action"] as string;
    if (accion !== "payment.created" && accion !== "payment.updated") return { procesado: false };
    const paymentId = (body["data"] as Record<string, string>)["id"] ?? null;
    if (!paymentId) return { procesado: false };
    return this._procesarPago(paymentId);
  },

  async procesarWebhookIpn(topic: string, paymentId: string) {
    if (topic !== "payment" || !paymentId) return { procesado: false };
    return this._procesarPago(paymentId);
  },

  async _procesarPago(paymentId: string) {
    let mpData: PaymentResponse;
    try {
      mpData = await obtenerPago(paymentId);
    } catch (err) {
      console.error("[webhook] Error consultando pago en MP:", err);
      return { procesado: false };
    }

    const status  = mpData.status  ?? "";
    const extRef  = mpData.external_reference ?? "";
    const mpPayId = String(mpData.id ?? "");

    if (status === "approved") {
      if (extRef.startsWith("sena-")) {
        await this._aprobarSena(extRef, mpPayId, status, mpData);
      } else if (extRef.startsWith("abono-")) {
        await this._aprobarAbono(extRef, mpPayId, status, mpData);
      }
    } else if (status === "rejected" || status === "cancelled") {
      await this._rechazarPago(extRef, mpPayId, status, mpData);
    }

    return { procesado: true };
  },

  // ─── APROBAR SEÑA ─────────────────────────────────────────────────────────
  // Idempotente: si la reserva ya no está en PENDIENTE_PAGO, no hace nada.

  async _aprobarSena(
    extRef:   string,
    mpPayId:  string,
    mpStatus: string,
    mpData:   PaymentResponse
  ) {
    const reservaId = Number(extRef.replace("sena-", ""));

    const reserva = await prisma.reserva.findUnique({
      where:   { id: reservaId },
      include: { cliente: true, instancia: true },
    });
    if (!reserva || reserva.estado !== "PENDIENTE_PAGO") return;

    const monto = mpData.transaction_amount ?? 0;

    const [, pago] = await prisma.$transaction([
      prisma.reserva.update({
        where: { id: reservaId },
        data:  { estado: "RESERVA_PAGA", montoPagado: { increment: monto } },
      }),
      prisma.pago.create({
        data: {
          reservaId,
          monto,
          metodo:    "MERCADO_PAGO",
          tipo:      "SENA",
          referencia: mpPayId,
        },
      }),
    ]);

    await prisma.pagoLog.create({
      data: {
        pagoId:        pago.id,
        evento:        "APROBADO",
        mpPaymentId:   mpPayId,
        mpStatus,
        mpRawResponse: paymentToLog(mpData),
      },
    });

    await mailReservaConfirmada(
      { nombre: reserva.cliente.nombre, email: reserva.cliente.email },
      { fecha: reserva.instancia.fecha, zona: reserva.instancia.zona }
    );
  },

  // ─── APROBAR ABONO ────────────────────────────────────────────────────────
  // Acredita las clases al cliente. extRef: "abono-{clienteId}-{clases}-{ts}"

  async _aprobarAbono(
    extRef:   string,
    mpPayId:  string,
    mpStatus: string,
    mpData:   PaymentResponse
  ) {
    const partes         = extRef.split("-");
    const clienteId      = Number(partes[1]);
    const cantidadClases = Number(partes[2]);

    const cliente = await prisma.usuario.findUnique({ where: { id: clienteId } });
    if (!cliente) return;

    const nuevasClases = cliente.clasesDisponibles + cantidadClases;

    await prisma.usuario.update({
      where: { id: clienteId },
      data:  { clasesDisponibles: nuevasClases, sancionado: false },
    });

    await actualizarTipoCliente(clienteId, nuevasClases);
  },

  // ─── RECHAZAR PAGO ────────────────────────────────────────────────────────
  // Solo aplica a pagos de seña. Cancela la reserva y libera el cupo.

  async _rechazarPago(
    extRef:   string,
    mpPayId:  string,
    mpStatus: string,
    mpData:   PaymentResponse
  ) {
    if (!extRef.startsWith("sena-")) return;

    const reservaId = Number(extRef.replace("sena-", ""));

    const reserva = await prisma.reserva.findUnique({
      where:   { id: reservaId },
      include: { instancia: true },
    });
    if (!reserva) return;

    if (reserva.estado === "PENDIENTE_PAGO") {
      await prisma.reserva.update({
        where: { id: reservaId },
        data:  { estado: "CANCELADA" },
      });
    }

    const monto = mpData.transaction_amount ?? 0;
    const pago  = await prisma.pago.create({
      data: {
        reservaId,
        monto,
        metodo:    "MERCADO_PAGO",
        tipo:      "SENA",
        referencia: mpPayId,
      },
    });

    await prisma.pagoLog.create({
      data: {
        pagoId:        pago.id,
        evento:        "FALLIDO",
        mpPaymentId:   mpPayId,
        mpStatus,
        mpRawResponse: paymentToLog(mpData),
      },
    });

    await colaService.notificarPrimero(reserva.instancia.id);
  },
};
