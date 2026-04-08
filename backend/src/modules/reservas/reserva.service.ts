import { prisma } from "../../db/prisma";
import { actualizarTipoCliente } from "../../utils/actualizarTipoCliente";
import { crearPreferencia, reembolsarPago } from "../../utils/mercadopago";
import { colaService } from "../cola-espera/cola.service";
import type { ZonaClase } from "../../types/models";
import {
  mailReservaConfirmada,
  mailReservaPendientePago,
  mailReservaCancelada,
  mailReembolsoProcesado,
} from "../../utils/mailer";

export const reservaService = {
  // ─── CREAR RESERVA ────────────────────────────────────────────────
  // Punto de entrada único para crear una reserva.
  // Deriva al flujo de abonado o no abonado según el tipo de cliente.

  async crear(clienteId: number, instanciaId: number) {
    const cliente = await prisma.usuario.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new Error("Usuario no encontrado");

    const instancia = await prisma.claseInstancia.findUnique({ where: { id: instanciaId } });
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

    // Contar solo reservas activas (excluye CANCELADAS y COMPLETADAS)
    const cuposOcupados = await prisma.reserva.count({
      where: {
        instanciaId,
        estado: { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] },
      },
    });

    // Sin cupo → cola de espera (no se crea reserva ni se llama a MP)
    if (cuposOcupados >= instancia.cupoMaximo) {
      const entrada = await colaService.unirse(instanciaId, clienteId);
      return { sinCupo: true, posicionCola: entrada.posicion };
    }

    const precioInstancia = Number(instancia.precio);

    if (cliente.tipoCliente === "ABONADO") {
      return await this._crearReservaAbonado(cliente, instancia, precioInstancia);
    } else {
      return await this._crearReservaNoAbonado(cliente, instancia, precioInstancia);
    }
  },

  // ─── FLUJO ABONADO ────────────────────────────────────────────────
  // El abonado ya pagó sus clases al cargar el abono.
  // Solo se confirma la reserva y se descuenta una clase disponible.
  // No se crea ningún registro de Pago ni PagoLog en este momento.

  async _crearReservaAbonado(
    cliente: { id: number; nombre: string; email: string; clasesDisponibles: number; sancionado: boolean },
    instancia: { id: number; fecha: Date; zona: ZonaClase },
    precioInstancia: number
  ) {
    if (cliente.clasesDisponibles <= 0) {
      throw new Error("No tenés clases disponibles. Cargá un abono para poder reservar.");
    }

    // Descuento 20% si no está sancionado
    const montoFinal   = cliente.sancionado ? precioInstancia : Math.round(precioInstancia * 0.8);
    const nuevasClases = cliente.clasesDisponibles - 1;

    const [reserva] = await prisma.$transaction([
      prisma.reserva.create({
        data: {
          clienteId:   cliente.id,
          instanciaId: instancia.id,
          estado:      "CONFIRMADA",
          montoPagado: montoFinal,
        },
      }),
      prisma.usuario.update({
        where: { id: cliente.id },
        data:  { clasesDisponibles: nuevasClases },
      }),
    ]);

    await actualizarTipoCliente(cliente.id, nuevasClases);

    await mailReservaConfirmada(
      { nombre: cliente.nombre, email: cliente.email },
      { fecha: instancia.fecha, zona: instancia.zona }
    );

    return { reserva, sinCupo: false };
  },

  // ─── FLUJO NO ABONADO ─────────────────────────────────────────────
  // Crea la reserva en PENDIENTE_PAGO y genera la preferencia de pago en MP.
  // NO se crea ningún registro en la tabla pagos todavía.
  // El Pago se crea recién cuando el webhook de MP confirma la aprobación.

  async _crearReservaNoAbonado(
    cliente: { id: number; nombre: string; email: string },
    instancia: { id: number; fecha: Date; zona: ZonaClase },
    precioInstancia: number
  ) {
    // La seña es el 50% del precio
    const monto = Math.round(precioInstancia * 0.5);

    const reserva = await prisma.reserva.create({
      data: {
        clienteId:   cliente.id,
        instanciaId: instancia.id,
        estado:      "PENDIENTE_PAGO",
        montoPagado: 0,
      },
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
        expiresEnMinutos:   360, // 6hs, alineado con el cron que cancela a las 5hs
      });
      initPoint = pref.init_point ?? "";
      mpPrefId  = pref.id ?? "";
    } catch (err) {
      console.error("[reservaService] Error generando preferencia MP:", err);
    }

    // Guardar el id de preferencia en la reserva para referencia futura
    if (mpPrefId) {
      await prisma.reserva.update({
        where: { id: reserva.id },
        data:  { mpPrefId },
      });
    }

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
        pagos:   { include: { logs: true } },
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
        pagos:     { include: { logs: true } },
        cliente:   { select: { id: true, nombre: true, apellido: true, email: true } },
        asistencia: true,
      },
    });
    if (!reserva) throw new Error("Reserva no encontrada");
    return reserva;
  },

  // ─── CANCELAR RESERVA ─────────────────────────────────────────────
  // La cancelación siempre notifica la cola de espera al final,
  // para que el siguiente en la fila tenga la chance de reservar.

  async cancelar(reservaId: number, solicitanteId: number) {
    const reserva = await prisma.reserva.findUnique({
      where: { id: reservaId },
      include: {
        cliente:  true,
        instancia: true,
        pagos:    { include: { logs: true } },
      },
    });
    if (!reserva) throw new Error("Reserva no encontrada");
    if (reserva.estado === "CANCELADA")  throw new Error("La reserva ya está cancelada");
    if (reserva.estado === "COMPLETADA") throw new Error("No se puede cancelar una clase completada");

    const { cliente, instancia } = reserva;

    if (cliente.tipoCliente === "ABONADO") {
      await this._cancelarAbonado(reserva, cliente, instancia, solicitanteId);
    } else {
      await this._cancelarNoAbonado(reserva, cliente, instancia, solicitanteId);
    }
  },

  // ─── CANCELACIÓN ABONADO ──────────────────────────────────────────
  // Con > 48hs: se devuelve la clase al saldo.
  // Con < 48hs: se aplica sanción, no se devuelve la clase.

  async _cancelarAbonado(
    reserva:   { id: number; pagos: Array<{ id: number; logs: Array<{ id: number }> }> },
    cliente:   { id: number; nombre: string; email: string; clasesDisponibles: number },
    instancia: { id: number; fecha: Date; zona: ZonaClase },
    solicitanteId: number
  ) {
    const msHastaClase = instancia.fecha.getTime() - Date.now();
    const hs48         = 48 * 60 * 60 * 1000;
    const conTiempo    = msHastaClase >= hs48;
    let nota: string | undefined;

    if (conTiempo) {
      // Devolver 1 clase al saldo
      const nuevasClases = cliente.clasesDisponibles + 1;
      await prisma.$transaction([
        prisma.reserva.update({ where: { id: reserva.id }, data: { estado: "CANCELADA" } }),
        prisma.usuario.update({ where: { id: cliente.id }, data: { clasesDisponibles: nuevasClases } }),
      ]);
      await actualizarTipoCliente(cliente.id, nuevasClases);
    } else {
      // Sanción: no se devuelve la clase
      nota = "Cancelaste con menos de 48hs de anticipación. La clase no se devuelve a tu saldo.";
      await prisma.$transaction([
        prisma.reserva.update({ where: { id: reserva.id }, data: { estado: "CANCELADA" } }),
        prisma.usuario.update({ where: { id: cliente.id }, data: { sancionado: true } }),
      ]);
    }

    // Log de auditoría en el pago del abono (si existe)
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

  // ─── CANCELACIÓN NO ABONADO ───────────────────────────────────────
  // PENDIENTE_PAGO: no hay pago que revertir, solo cancelar.
  // RESERVA_PAGA con > 24hs: reembolso vía MP.
  // RESERVA_PAGA con < 24hs: pierde la seña.

  async _cancelarNoAbonado(
    reserva: {
      id:     number;
      estado: string;
      pagos:  Array<{ id: number; monto: object; logs: Array<{ mpPaymentId?: string | null }> }>;
    },
    cliente:   { id: number; nombre: string; email: string },
    instancia: { id: number; fecha: Date; zona: ZonaClase },
    solicitanteId: number
  ) {
    const { estado, pagos } = reserva;

    // ── Sin pago aún (no llegó a pagar la seña) ──
    if (estado === "PENDIENTE_PAGO") {
      await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: "CANCELADA" } });
      await mailReservaCancelada(
        { nombre: cliente.nombre, email: cliente.email },
        { fecha: instancia.fecha, zona: instancia.zona }
      );
      await colaService.notificarPrimero(instancia.id);
      return;
    }

    // ── Seña pagada: aplicar política de cancelación ──
    if (estado === "RESERVA_PAGA") {
      const msHasta   = instancia.fecha.getTime() - Date.now();
      const hs24      = 24 * 60 * 60 * 1000;
      const conTiempo = msHasta >= hs24;

      const pagoPrincipal = pagos[0];
      const mpPaymentId   = pagoPrincipal?.logs.find((l) => l.mpPaymentId)?.mpPaymentId ?? null;

      await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: "CANCELADA" } });

      if (conTiempo) {
        // Reembolso total vía MP
        if (mpPaymentId) {
          try {
            await reembolsarPago(mpPaymentId);
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
      } else {
        // Menos de 24hs: pierde la seña
        const nota = "Cancelaste con menos de 24hs de anticipación. Perdés la seña abonada.";
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
      }

      await colaService.notificarPrimero(instancia.id);
      return;
    }

    // Estado inesperado: cancelar de todas formas sin lógica de pago
    await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: "CANCELADA" } });
    await mailReservaCancelada(
      { nombre: cliente.nombre, email: cliente.email },
      { fecha: instancia.fecha, zona: instancia.zona }
    );
    await colaService.notificarPrimero(instancia.id);
  },
};
