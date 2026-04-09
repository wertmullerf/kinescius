import { prisma } from "../../db/prisma";
import { actualizarTipoCliente } from "../../utils/actualizarTipoCliente";
import {
  crearPreferencia,
  obtenerPago,
  paymentToLog,
  type PaymentResponse,
} from "../../utils/mercadopago";
import { colaService } from "../cola-espera/cola.service";
import { mailReservaConfirmada, mailAbonoConfirmado } from "../../utils/mailer";
import type { MetodoPago } from "../../types/models";

export const pagoService = {

  // ─── ABONO PRESENCIAL (ADMIN) ──────────────────────────────────────────────

  async cargarAbonoPresencial(
    clienteId:      number,
    cantidadClases: number,
    precioPorClase: number,
    metodo:         MetodoPago,
    solicitanteId:  number,
    referencia?:    string
  ) {
    const cliente = await prisma.usuario.findUnique({ where: { id: clienteId } });
    if (!cliente)                  throw new Error("Cliente no encontrado");
    if (cliente.rol !== "CLIENTE") throw new Error("El usuario no es un cliente");

    // Cálculo: cantidadClases × precioPorClase, con 20% de descuento si no está sancionado
    const montoBase  = cantidadClases * precioPorClase;
    const montoFinal = cliente.sancionado ? montoBase : Math.round(montoBase * 0.8);

    const nuevasClases = cliente.clasesDisponibles + cantidadClases;

    await prisma.usuario.update({
      where: { id: clienteId },
      data:  { clasesDisponibles: nuevasClases, sancionado: false },
    });

    await actualizarTipoCliente(clienteId, nuevasClases);

    const pagoAbono = await prisma.pagoAbono.create({
      data: {
        clienteId,
        cantidadClases,
        monto:      montoFinal,
        metodo,
        referencia: referencia ?? null,
      },
    });

    return { clienteId, cantidadClases, nuevasClases, precioPorClase, montoFinal, metodo, pagoAbonoId: pagoAbono.id };
  },

  // ─── ABONO POR MP (CLIENTE) ───────────────────────────────────────────────

  async iniciarAbonoMp(clienteId: number, cantidadClases: number, precioPorClase: number) {
    const cliente = await prisma.usuario.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new Error("Cliente no encontrado");

    // Cálculo: cantidadClases × precioPorClase, con 20% de descuento si no está sancionado
    const montoBase  = cantidadClases * precioPorClase;
    const montoFinal = cliente.sancionado ? montoBase : Math.round(montoBase * 0.8);

    // Codificamos precioPorClase en el extRef para que el webhook pueda reconstruir el desglose
    const extRef = `abono-${clienteId}-${cantidadClases}-${precioPorClase}-${Date.now()}`;

    const pref = await crearPreferencia({
      items: [
        {
          id:          extRef,
          title:       `Abono ${cantidadClases} clases - Kinescius`,
          unit_price:  montoFinal,
          quantity:    1,
          currency_id: "ARS",
        },
      ],
      external_reference: extRef,
    });

    return {
      initPoint:          pref.init_point,
      external_reference: extRef,
      montoFinal,
      mpPrefId:           pref.id,
    };
  },

  // ─── COMPLEMENTO (ADMIN) ──────────────────────────────────────────────────

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
        data:  { montoPagado: { increment: montoRestante }, estado: "CONFIRMADA" },
      }),
    ]);

    await prisma.pagoLog.create({
      data: { pagoId: pago.id, evento: "CREADO", solicitadoPor: solicitanteId },
    });

    return pago;
  },

  // ─── ABONOS DE UN CLIENTE ─────────────────────────────────────────────────

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

  // ─── WEBHOOK — FORMATO NUEVO (POST con JSON body) ─────────────────────────
  // Body: { type: "payment", action: "payment.created|updated", data: { id: "..." } }

  async procesarWebhookPost(body: Record<string, string | object>) {
    const type   = body["type"]   as string | undefined;
    const action = body["action"] as string | undefined;
    const data   = body["data"]   as Record<string, string> | undefined;
    const topic  = body["topic"]  as string | undefined;

    let paymentId: string | null = null;

    if (type === "payment" && data) {
      if (action !== "payment.created" && action !== "payment.updated") {
        return { procesado: false, motivo: "accion_ignorada" };
      }
      paymentId = data["id"] ?? null;
    } else if (topic === "payment") {
      // Algunos accounts de MP envían en el body: { topic: "payment", id: "..." }
      paymentId = String(body["id"] ?? "");
    }

    if (!paymentId) return { procesado: false, motivo: "sin_payment_id" };

    return this._procesarPago(paymentId);
  },

  // ─── WEBHOOK — FORMATO IPN (GET con query params) ─────────────────────────
  // Query: ?topic=payment&id=PAYMENT_ID
  // MP usa este formato para notificaciones IPN heredadas y para Checkout Pro
  // en algunos contextos de cuenta.

  async procesarWebhookIpn(topic: string, paymentId: string) {
    if (topic !== "payment" || !paymentId) {
      return { procesado: false, motivo: "topic_o_id_invalido" };
    }
    return this._procesarPago(paymentId);
  },

  // ─── LÓGICA CENTRAL DE PROCESAMIENTO ─────────────────────────────────────
  // Consulta el pago en MP y deriva según status + external_reference.
  // Compartida por el handler POST y el GET para evitar duplicación.

  async _procesarPago(paymentId: string) {
    let mpData: PaymentResponse;
    try {
      mpData = await obtenerPago(paymentId);
    } catch (err) {
      console.error("[webhook] Error consultando pago en MP:", err);
      return { procesado: false, motivo: "error_consultando_mp" };
    }

    const status  = mpData.status             ?? "";
    const extRef  = mpData.external_reference ?? "";
    const mpPayId = String(mpData.id          ?? "");

    console.log(`[webhook] payment ${mpPayId} | status: ${status} | ref: ${extRef}`);

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
          metodo:     "MERCADO_PAGO",
          tipo:       "SENA",
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

  async _aprobarAbono(
    extRef:   string,
    mpPayId:  string,
    mpStatus: string,
    mpData:   PaymentResponse
  ) {
    // Idempotencia: si el webhook llega dos veces, no procesar dos veces
    const yaProcessado = await prisma.pagoAbono.findFirst({ where: { mpPaymentId: mpPayId } });
    if (yaProcessado) {
      console.log(`[webhook] Abono ${mpPayId} ya procesado, ignorando`);
      return;
    }

    // extRef: "abono-{clienteId}-{cantidadClases}-{precioPorClase}-{timestamp}"
    const partes         = extRef.split("-");
    const clienteId      = Number(partes[1]);
    const cantidadClases = Number(partes[2]);
    const precioPorClase = Number(partes[3]);

    const cliente = await prisma.usuario.findUnique({ where: { id: clienteId } });
    if (!cliente) return;

    const nuevasClases = cliente.clasesDisponibles + cantidadClases;

    await prisma.usuario.update({
      where: { id: clienteId },
      data:  { clasesDisponibles: nuevasClases, sancionado: false },
    });

    await actualizarTipoCliente(clienteId, nuevasClases);

    const monto = mpData.transaction_amount ?? 0;

    await prisma.pagoAbono.create({
      data: {
        clienteId,
        cantidadClases,
        monto,
        metodo:       "MERCADO_PAGO",
        mpPaymentId:  mpPayId,
        mpRawResponse: paymentToLog(mpData),
      },
    });

    await mailAbonoConfirmado(
      { nombre: cliente.nombre, email: cliente.email },
      { cantidadClases, precioPorClase, montoTotal: monto }
    );
  },

  // ─── RECHAZAR PAGO ────────────────────────────────────────────────────────

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
        metodo:     "MERCADO_PAGO",
        tipo:       "SENA",
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
