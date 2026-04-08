import { prisma } from "../../db/prisma";
import { actualizarTipoCliente } from "../../utils/actualizarTipoCliente";
import { crearPreferencia, obtenerPago } from "../../utils/mercadopago";
import { colaService } from "../cola-espera/cola.service";
import { mailReservaConfirmada } from "../../utils/mailer";
import type { MetodoPago } from "../../types/models";

export const pagoService = {
  // ─── ABONO PRESENCIAL (ADMIN) ──────────────────────────────────────
  // El admin registra manualmente un abono de un cliente (efectivo o transferencia).
  // No genera reserva; solo incrementa clasesDisponibles del cliente.

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
  // El cliente paga un paquete de clases vía Mercado Pago.
  // Genera una preferencia y retorna el initPoint para redirigir al cliente.
  // El acreditado de clases lo hace el webhook cuando MP confirma el pago.

  async iniciarAbonoMp(
    clienteId:      number,
    cantidadClases: number,
    monto:          number
  ) {
    const ts     = Date.now();
    const extRef = `abono-${clienteId}-${cantidadClases}-${ts}`;

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
      });
      initPoint = pref.init_point ?? "";
      mpPrefId  = pref.id ?? "";
    } catch (err) {
      console.error("[pagoService] Error generando preferencia abono MP:", err);
    }

    return { initPoint, external_reference: extRef, mpPrefId };
  },

  // ─── COMPLEMENTO (ADMIN) ──────────────────────────────────────────
  // El admin registra el 50% restante que el cliente paga presencialmente.
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

    const precioInstancia = Number(reserva.instancia.precio);
    const montoRestante   = precioInstancia - Number(reserva.montoPagado);

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
      where:   { reservaId },
      include: { logs: true },
      orderBy: { createdAt: "asc" },
    });
  },

  // ─── WEBHOOK DE MERCADO PAGO ──────────────────────────────────────
  // Endpoint público (sin auth). MP reintenta si no recibe HTTP 200,
  // por eso SIEMPRE respondemos 200 aunque falle internamente.
  //
  // MP envía dos formatos distintos:
  //
  //   Formato A (el más común):
  //   { "type": "payment", "action": "payment.created|updated", "data": { "id": "123" } }
  //
  //   Formato B (legacy IPN):
  //   { "topic": "payment", "id": "123" }

  async procesarWebhook(body: Record<string, unknown>, signature: string) {
    console.log("[webhook] Body recibido:", JSON.stringify(body), "| x-signature:", signature);

    // ── Extraer el payment ID según el formato recibido ──
    let paymentId: string | null = null;

    if (body.type === "payment" && body.data) {
      // Formato A
      paymentId = (body.data as Record<string, string>)?.id ?? null;
      const accion = body.action as string;
      console.log(`[webhook] Formato A — acción: ${accion}, paymentId: ${paymentId}`);

      // Ignorar eventos que no sean de pago creado o actualizado
      if (accion !== "payment.created" && accion !== "payment.updated") {
        console.log(`[webhook] Acción "${accion}" ignorada`);
        return { procesado: false };
      }
    } else if (body.topic === "payment") {
      // Formato B (legacy IPN)
      paymentId = String(body.id ?? "");
      console.log(`[webhook] Formato B (IPN) — paymentId: ${paymentId}`);
    }

    if (!paymentId) {
      console.log("[webhook] No se pudo extraer el payment ID, ignorando");
      return { procesado: false };
    }

    // ── Consultar detalles del pago en MP ──
    let mpData: Record<string, unknown> = {};
    try {
      mpData = await obtenerPago(paymentId);
    } catch (err) {
      console.error("[webhook] Error consultando pago en MP:", err);
      return { procesado: false };
    }

    const status  = mpData.status as string;
    const extRef  = mpData.external_reference as string;
    const mpPayId = String(mpData.id ?? "");

    console.log(`[webhook] Pago de MP — status: ${status}, external_reference: ${extRef}, mpPayId: ${mpPayId}`);

    // ── Derivar según el status y el external_reference ──
    if (status === "approved") {
      if (extRef?.startsWith("sena-")) {
        await this._aprobarSena(extRef, mpPayId, status, mpData);
      } else if (extRef?.startsWith("abono-")) {
        await this._aprobarAbono(extRef, mpPayId, status, mpData);
      } else {
        console.log(`[webhook] external_reference desconocido: ${extRef}`);
      }
    } else if (status === "rejected" || status === "cancelled") {
      await this._rechazarPago(extRef, mpPayId, status, mpData);
    } else {
      // pending, in_process, etc. — se espera el siguiente evento
      console.log(`[webhook] Status "${status}" no requiere acción`);
    }

    return { procesado: true };
  },

  // ─── APROBAR SEÑA ─────────────────────────────────────────────────
  // Llamado cuando MP confirma el pago de una seña.
  // Crea el registro de Pago y actualiza la Reserva a RESERVA_PAGA.
  // Es idempotente: si la reserva ya no está en PENDIENTE_PAGO, no hace nada.

  async _aprobarSena(
    extRef:   string,
    mpPayId:  string,
    mpStatus: string,
    mpData:   Record<string, unknown>
  ) {
    const reservaId = Number(extRef.replace("sena-", ""));
    console.log(`[webhook] Procesando aprobación de seña para reservaId: ${reservaId}`);

    const reserva = await prisma.reserva.findUnique({
      where:   { id: reservaId },
      include: { cliente: true, instancia: true },
    });

    if (!reserva) {
      console.log(`[webhook] Reserva ${reservaId} no encontrada`);
      return;
    }

    console.log(`[webhook] Reserva encontrada — estado actual: ${reserva.estado}`);

    if (reserva.estado !== "PENDIENTE_PAGO") {
      console.log(`[webhook] Reserva ${reservaId} ya procesada (estado: ${reserva.estado}), ignorando`);
      return;
    }

    const monto = Number(mpData.transaction_amount ?? 0);
    console.log(`[webhook] ${reserva.estado} → RESERVA_PAGA (monto: $${monto})`);

    // Crear el Pago y actualizar la Reserva en una sola transacción
    const [, pago] = await prisma.$transaction([
      prisma.reserva.update({
        where: { id: reservaId },
        data: {
          estado:      "RESERVA_PAGA",
          montoPagado: { increment: monto },
        },
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
        mpRawResponse: mpData as never,
      },
    });

    await mailReservaConfirmada(
      { nombre: reserva.cliente.nombre, email: reserva.cliente.email },
      { fecha: reserva.instancia.fecha, zona: reserva.instancia.zona }
    );
  },

  // ─── APROBAR ABONO ────────────────────────────────────────────────
  // Llamado cuando MP confirma el pago de un paquete de clases.
  // Acredita las clases al cliente.

  async _aprobarAbono(
    extRef:   string,
    mpPayId:  string,
    mpStatus: string,
    mpData:   Record<string, unknown>
  ) {
    // extRef format: abono-{clienteId}-{cantidadClases}-{ts}
    const partes         = extRef.split("-");
    const clienteId      = Number(partes[1]);
    const cantidadClases = Number(partes[2]);

    const cliente = await prisma.usuario.findUnique({ where: { id: clienteId } });
    if (!cliente) {
      console.log(`[webhook] Cliente ${clienteId} no encontrado para abono`);
      return;
    }

    const nuevasClases = cliente.clasesDisponibles + cantidadClases;

    await prisma.usuario.update({
      where: { id: clienteId },
      data: {
        clasesDisponibles: nuevasClases,
        sancionado:        false,
      },
    });

    await actualizarTipoCliente(clienteId, nuevasClases);
    console.log(`[webhook] Abono aprobado — cliente ${clienteId}: +${cantidadClases} clases (total: ${nuevasClases})`);
  },

  // ─── RECHAZAR PAGO ────────────────────────────────────────────────
  // Llamado cuando MP rechaza o cancela un pago de seña.
  // Cancela la reserva y notifica al siguiente en la cola de espera.

  async _rechazarPago(
    extRef:   string,
    mpPayId:  string,
    mpStatus: string,
    mpData:   Record<string, unknown>
  ) {
    if (!extRef?.startsWith("sena-")) return;

    const reservaId = Number(extRef.replace("sena-", ""));
    console.log(`[webhook] Procesando rechazo de pago para reservaId: ${reservaId}`);

    const reserva = await prisma.reserva.findUnique({
      where:   { id: reservaId },
      include: { instancia: true },
    });

    if (!reserva) {
      console.log(`[webhook] Reserva ${reservaId} no encontrada`);
      return;
    }

    if (reserva.estado === "PENDIENTE_PAGO") {
      await prisma.reserva.update({
        where: { id: reservaId },
        data:  { estado: "CANCELADA" },
      });
    }

    // Registrar el intento fallido para auditoría
    const monto = Number(mpData.transaction_amount ?? 0);
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
        mpRawResponse: mpData as never,
      },
    });

    console.log(`[webhook] Reserva ${reservaId} cancelada — pago ${mpStatus}`);

    // Liberar el cupo para el siguiente en la cola
    await colaService.notificarPrimero(reserva.instancia.id);
  },
};
