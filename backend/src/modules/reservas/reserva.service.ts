import { prisma } from "../../db/prisma";
import { actualizarTipoCliente } from "../../utils/actualizarTipoCliente";
import { crearPreferencia, mpRefund } from "../../utils/mercadopago";
import { colaService } from "../cola-espera/cola.service";
import type { ZonaClase } from "../../types/models";
import {
  mailReservaConfirmada,
  mailReservaPendientePago,
  mailReservaCancelada,
  mailReembolsoProcesado,
} from "../../utils/mailer";

// Timers de expiración de reservas pendientes: reservaId → NodeJS.Timeout
const timersExpiracion = new Map<number, NodeJS.Timeout>();

export function cancelarTimerExpiracion(reservaId: number) {
  const t = timersExpiracion.get(reservaId);
  if (t) {
    clearTimeout(t);
    timersExpiracion.delete(reservaId);
  }
}

export const reservaService = {
  // ─── CREAR RESERVA ────────────────────────────────────────────────

  async crear(clienteId: number, instanciaId: number) {
    const cliente = await prisma.usuario.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new Error("Usuario no encontrado");

    const instancia = await prisma.claseInstancia.findUnique({
      where: { id: instanciaId },
    });
    if (!instancia) throw new Error("Clase no encontrada");

    // ¿Ya tiene reserva activa en esta instancia?
    const reservaExistente = await prisma.reserva.findFirst({
      where: {
        clienteId,
        instanciaId,
        estado: { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] },
      },
    });
    if (reservaExistente) throw new Error("Ya tenés una reserva activa en esta clase");

    // Bug 1 fix: contar solo reservas activas, no las CANCELADAS ni COMPLETADAS
    const reservasActuales = await prisma.reserva.count({
      where: {
        instanciaId,
        estado: { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] },
      },
    });
    const precioInstancia  = Number(instancia.precio);

    // ── Sin cupo → cola de espera ──
    if (reservasActuales >= instancia.cupoMaximo) {
      const entrada = await colaService.unirse(instanciaId, clienteId);
      return { sinCupo: true, posicionCola: entrada.posicion };
    }

    if (cliente.tipoCliente === "ABONADO") {
      return await this._crearReservaAbonado(cliente, instancia, precioInstancia);
    } else {
      return await this._crearReservaNoAbonado(cliente, instancia, precioInstancia);
    }
  },

  async _crearReservaAbonado(
    cliente: { id: number; nombre: string; email: string; clasesDisponibles: number; sancionado: boolean },
    instancia: { id: number; fecha: Date; zona: ZonaClase },
    precioInstancia: number
  ) {
    if (cliente.clasesDisponibles <= 0) {
      throw new Error(
        "No tenés clases disponibles. Cargá un abono para poder reservar."
      );
    }

    // Descuento 20% si no está sancionado
    const montoFinal = cliente.sancionado
      ? precioInstancia
      : Math.round(precioInstancia * 0.8);

    const nuevasClases = cliente.clasesDisponibles - 1;

    const [reserva] = await prisma.$transaction([
      prisma.reserva.create({
        data: { clienteId: cliente.id, instanciaId: instancia.id, estado: "CONFIRMADA", montoPagado: montoFinal },
      }),
      prisma.usuario.update({
        where: { id: cliente.id },
        data: { clasesDisponibles: nuevasClases },
      }),
    ]);

    await actualizarTipoCliente(cliente.id, nuevasClases);

    const pago = await prisma.pago.create({
      data: {
        reservaId: reserva.id,
        monto:     montoFinal,
        metodo:    "EFECTIVO",
        tipo:      "ABONO",
      },
    });

    await prisma.pagoLog.create({
      data: {
        pagoId:        pago.id,
        evento:        "CREADO",
        solicitadoPor: cliente.id,
      },
    });

    await mailReservaConfirmada(
      { nombre: cliente.nombre, email: cliente.email },
      { fecha: instancia.fecha, zona: instancia.zona }
    );

    return { reserva, sinCupo: false };
  },

  async _crearReservaNoAbonado(
    cliente: { id: number; nombre: string; email: string },
    instancia: { id: number; fecha: Date; zona: ZonaClase },
    precioInstancia: number
  ) {
    const monto = Math.round(precioInstancia * 0.5);

    const reserva = await prisma.reserva.create({
      data: { clienteId: cliente.id, instanciaId: instancia.id, estado: "PENDIENTE_PAGO", montoPagado: 0 },
    });

    // Generar preferencia de pago en MP
    let initPoint = "";
    let mpPrefId  = "";
    try {
      const pref = await crearPreferencia({
        items: [
          {
            id:          `sena-${reserva.id}`,
            title:       `Seña - Clase ${instancia.zona} ${instancia.fecha.toLocaleDateString("es-AR")}`,
            unit_price:  monto,
            quantity:    1,
            currency_id: "ARS",
          },
        ],
        external_reference: `sena-${reserva.id}`,
        expiresEnMinutos:   20, // un poco más que el timer de 15 min
      });
      initPoint = pref.init_point ?? pref.sandbox_init_point ?? "";
      mpPrefId  = pref.id ?? "";
    } catch (err) {
      console.error("[reservaService] Error generando preferencia MP:", err);
    }

    const pago = await prisma.pago.create({
      data: {
        reservaId: reserva.id,
        monto,
        metodo:    "TRANSFERENCIA",
        tipo:      "SENA",
        referencia: mpPrefId || null,
      },
    });

    await prisma.pagoLog.create({
      data: {
        pagoId:        pago.id,
        evento:        "PENDIENTE",
        solicitadoPor: cliente.id,
      },
    });

    // Expiración automática a los 15 minutos
    const timer = setTimeout(async () => {
      timersExpiracion.delete(reserva.id);
      try {
        const r = await prisma.reserva.findUnique({ where: { id: reserva.id } });
        if (!r || r.estado !== "PENDIENTE_PAGO") return;

        await prisma.reserva.update({
          where: { id: reserva.id },
          data:  { estado: "CANCELADA" },
        });

        // Bug 2 fix: notificar al cliente y liberar el cupo a la cola
        await mailReservaCancelada(
          { nombre: cliente.nombre, email: cliente.email },
          { fecha: instancia.fecha, zona: instancia.zona },
          "Tu reserva fue cancelada automáticamente porque no se completó el pago en 15 minutos."
        );
        await colaService.notificarPrimero(instancia.id);
      } catch (e) {
        console.error("[reservaService] Error en expiración de reserva:", e);
      }
    }, 15 * 60 * 1000);

    timersExpiracion.set(reserva.id, timer);

    await mailReservaPendientePago(
      { nombre: cliente.nombre, email: cliente.email },
      { fecha: instancia.fecha, zona: instancia.zona },
      initPoint
    );

    return { reserva, initPoint, sinCupo: false };
  },

  // ─── LISTAR RESERVAS ──────────────────────────────────────────────

  async listar(clienteId?: number) {
    const where = clienteId ? { clienteId } : {};
    return prisma.reserva.findMany({
      where,
      include: {
        instancia: {
          include: { profesor: { select: { id: true, nombre: true, apellido: true } } },
        },
        pagos: { include: { logs: true } },
        cliente: { select: { id: true, nombre: true, apellido: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  // ─── OBTENER RESERVA ──────────────────────────────────────────────

  async obtener(id: number) {
    const reserva = await prisma.reserva.findUnique({
      where: { id },
      include: {
        instancia: {
          include: { profesor: { select: { id: true, nombre: true, apellido: true } } },
        },
        pagos: { include: { logs: true } },
        cliente: { select: { id: true, nombre: true, apellido: true, email: true } },
        asistencia: true,
      },
    });
    if (!reserva) throw new Error("Reserva no encontrada");
    return reserva;
  },

  // ─── CANCELAR RESERVA ─────────────────────────────────────────────

  async cancelar(reservaId: number, solicitanteId: number) {
    const reserva = await prisma.reserva.findUnique({
      where: { id: reservaId },
      include: {
        cliente: true,
        instancia: true,
        pagos: { include: { logs: true } },
      },
    });
    if (!reserva) throw new Error("Reserva no encontrada");

    if (reserva.estado === "CANCELADA") throw new Error("La reserva ya está cancelada");
    if (reserva.estado === "COMPLETADA") throw new Error("No se puede cancelar una clase completada");

    const { cliente, instancia } = reserva;

    if (cliente.tipoCliente === "ABONADO") {
      await this._cancelarAbonado(reserva, cliente, instancia, solicitanteId);
    } else {
      await this._cancelarNoAbonado(reserva, cliente, instancia, solicitanteId);
    }
  },

  async _cancelarAbonado(
    reserva: { id: number; pagos: Array<{ id: number; logs: Array<{ id: number }> }> },
    cliente: { id: number; nombre: string; email: string; clasesDisponibles: number },
    instancia: { id: number; fecha: Date; zona: ZonaClase },
    solicitanteId: number
  ) {
    const ahora         = Date.now();
    const msHastaClase  = instancia.fecha.getTime() - ahora;
    const hs48          = 48 * 60 * 60 * 1000;
    const conTiempo     = msHastaClase >= hs48;

    let nota: string | undefined;

    if (conTiempo) {
      // Devolver 1 clase
      const nuevasClases = cliente.clasesDisponibles + 1;
      await prisma.$transaction([
        prisma.reserva.update({ where: { id: reserva.id }, data: { estado: "CANCELADA" } }),
        prisma.usuario.update({ where: { id: cliente.id }, data: { clasesDisponibles: nuevasClases } }),
      ]);
      await actualizarTipoCliente(cliente.id, nuevasClases);
    } else {
      // No se devuelve la clase, se aplica sanción
      nota = "Cancelaste con menos de 48hs de anticipación. La clase no se devuelve a tu saldo.";
      await prisma.$transaction([
        prisma.reserva.update({ where: { id: reserva.id }, data: { estado: "CANCELADA" } }),
        prisma.usuario.update({ where: { id: cliente.id }, data: { sancionado: true } }),
      ]);
    }

    // PagoLog REVERTIDO en el primer pago
    if (reserva.pagos.length > 0) {
      await prisma.pagoLog.create({
        data: {
          pagoId:        reserva.pagos[0].id,
          evento:        "REVERTIDO",
          solicitadoPor: solicitanteId,
          mpRawResponse: nota ? { nota } : undefined,
        },
      });
    }

    await mailReservaCancelada(
      { nombre: cliente.nombre, email: cliente.email },
      { fecha: instancia.fecha, zona: instancia.zona },
      nota
    );

    await colaService.notificarPrimero(instancia.id);
  },

  async _cancelarNoAbonado(
    reserva: {
      id: number;
      estado: string;
      pagos: Array<{
        id: number;
        monto: object;
        logs: Array<{ mpPaymentId?: string | null }>;
      }>;
    },
    cliente: { id: number; nombre: string; email: string },
    instancia: { id: number; fecha: Date; zona: ZonaClase },
    solicitanteId: number
  ) {
    const { estado, pagos } = reserva;

    if (estado === "PENDIENTE_PAGO") {
      cancelarTimerExpiracion(reserva.id);
      await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: "CANCELADA" } });
      await mailReservaCancelada(
        { nombre: cliente.nombre, email: cliente.email },
        { fecha: instancia.fecha, zona: instancia.zona }
      );
      return;
    }

    if (estado === "RESERVA_PAGA") {
      const ahora       = Date.now();
      const msHasta     = instancia.fecha.getTime() - ahora;
      const hs24        = 24 * 60 * 60 * 1000;
      const conTiempo   = msHasta >= hs24;

      const pagoPrincipal = pagos[0];
      const mpPaymentId   = pagoPrincipal?.logs.find((l) => l.mpPaymentId)?.mpPaymentId ?? null;

      if (conTiempo) {
        await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: "CANCELADA" } });

        // Reembolso MP (devolución total)
        if (mpPaymentId) {
          try {
            await mpRefund.total({ payment_id: Number(mpPaymentId) });
          } catch (err) {
            console.error("[reservaService] Error procesando reembolso MP:", err);
          }
        }

        if (pagoPrincipal) {
          await prisma.pagoLog.create({
            data: {
              pagoId:        pagoPrincipal.id,
              evento:        "REVERTIDO",
              mpPaymentId:   mpPaymentId ?? undefined,
              solicitadoPor: solicitanteId,
            },
          });
          await mailReembolsoProcesado(
            { nombre: cliente.nombre, email: cliente.email },
            { monto: Number(pagoPrincipal.monto) }
          );
        }

        await colaService.notificarPrimero(instancia.id);
      } else {
        const nota = "Cancelaste con menos de 24hs de anticipación. Perdés la seña abonada.";
        await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: "CANCELADA" } });

        if (pagoPrincipal) {
          await prisma.pagoLog.create({
            data: {
              pagoId:        pagoPrincipal.id,
              evento:        "REVERTIDO",
              solicitadoPor: solicitanteId,
              mpRawResponse: { nota },
            },
          });
        }

        await mailReservaCancelada(
          { nombre: cliente.nombre, email: cliente.email },
          { fecha: instancia.fecha, zona: instancia.zona },
          nota
        );

        // Bug 3 fix: notificar cola aunque el cliente pierda la seña
        await colaService.notificarPrimero(instancia.id);
      }

      return;
    }

    // Bug 5 fix: estado inesperado — cancelar de todas formas sin lógica de pago
    await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: "CANCELADA" } });
    await mailReservaCancelada(
      { nombre: cliente.nombre, email: cliente.email },
      { fecha: instancia.fecha, zona: instancia.zona }
    );
    await colaService.notificarPrimero(instancia.id);
  },
};
