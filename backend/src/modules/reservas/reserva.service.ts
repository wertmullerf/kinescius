import { prisma } from "../../db/prisma";
import { actualizarTipoCliente } from "../../utils/actualizarTipoCliente";
import { crearPreferencia, reembolsarPago } from "../../utils/mercadopago";
import { colaService } from "../cola-espera/cola.service";
import type { ZonaClase } from "../../types/models";
import {
  mailReservaConfirmada,
  mailReservaCancelada,
  mailReembolsoProcesado,
} from "../../utils/mailer";

export const reservaService = {
  // ─── CREAR RESERVA ────────────────────────────────────────────────
  // Punto de entrada único para crear una reserva.
  // Deriva al flujo de abonado o no abonado según el tipo de cliente.

  async crear(clienteId: number, instanciaId: number) {
    const cliente   = await prisma.usuario.findUnique({ where: { id: clienteId } });
    if (!cliente)   throw new Error("Usuario no encontrado");

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

    // ── Prioridad de cola ──────────────────────────────────────────────────────
    // Si hay alguien en la cola con ventana activa (expiraEn > ahora), ese cupo
    // está reservado para él. Cualquier otro usuario va directo a la cola.
    const colaConPrioridad = await prisma.colaEspera.findFirst({
      where:   { instanciaId, expiraEn: { gt: new Date() } },
      orderBy: { posicion: "asc" },
    });

    if (colaConPrioridad && colaConPrioridad.clienteId !== clienteId) {
      // Este usuario no tiene prioridad — va a la cola (o devuelve su posición si ya está)
      const yaEnCola = await prisma.colaEspera.findUnique({
        where: { instanciaId_clienteId: { instanciaId, clienteId } },
      });
      if (yaEnCola) return { sinCupo: true, posicionCola: yaEnCola.posicion };
      const entrada = await colaService.unirse(instanciaId, clienteId);
      return { sinCupo: true, posicionCola: entrada.posicion };
    }

    // ── Cupos disponibles ─────────────────────────────────────────────────────
    const cuposOcupados = await prisma.reserva.count({
      where: {
        instanciaId,
        estado: { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] },
      },
    });

    if (cuposOcupados >= instancia.cupoMaximo) {
      // Sin cupo — si ya está en la cola, devolver su posición
      const yaEnCola = await prisma.colaEspera.findUnique({
        where: { instanciaId_clienteId: { instanciaId, clienteId } },
      });
      if (yaEnCola) return { sinCupo: true, posicionCola: yaEnCola.posicion };
      const entrada = await colaService.unirse(instanciaId, clienteId);
      return { sinCupo: true, posicionCola: entrada.posicion };
    }

    // Hay cupo — si el usuario venía de la cola, sacarlo correctamente (reordena posiciones)
    const enCola = await prisma.colaEspera.findUnique({
      where: { instanciaId_clienteId: { instanciaId, clienteId } },
    });
    if (enCola) await colaService.salir(instanciaId, clienteId);

    const precioInstancia = Number(instancia.precio);

    if (cliente.tipoCliente === "ABONADO") {
      return this._crearReservaAbonado(cliente, instancia, precioInstancia);
    } else {
      return this._crearReservaNoAbonado(cliente, instancia, precioInstancia);
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
        expiresEnMinutos:   360,
        returnPath:         "/reservas",
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

    // await mailReservaPendientePago(
    //   { nombre: cliente.nombre, email: cliente.email },
    //   { fecha: instancia.fecha, zona: instancia.zona },
    //   initPoint
    // );

    return { reserva, initPoint, sinCupo: false };
  },

  // ─── CAMBIAR CLASE ────────────────────────────────────────────────
  // Permite a un cliente mover su reserva a otra instancia del mismo día y zona,
  // siempre que la nueva instancia tenga cupo libre.
  //
  // ABONADO:     se mueve la reserva sin tocar clasesDisponibles (efecto neto: 0 clases perdidas).
  // NO ABONADO:  se mueve la reserva; la seña (Pago) queda asociada a la nueva instancia via reserva.

  async cambiar(reservaId: number, clienteId: number, nuevaInstanciaId: number) {
    const reserva = await prisma.reserva.findUnique({
      where: { id: reservaId },
      include: {
        cliente:   true,
        instancia: true,
        pagos:     { include: { logs: true } },
      },
    });
    if (!reserva)                              throw new Error("Reserva no encontrada");
    if (reserva.clienteId !== clienteId)       throw new Error("No tenés permiso para cambiar esta reserva");
    if (!["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"].includes(reserva.estado)) {
      throw new Error("Solo se pueden cambiar reservas activas");
    }

    if (reserva.instanciaId === nuevaInstanciaId) {
      throw new Error("La nueva clase debe ser diferente a la actual");
    }

    const nuevaInstancia = await prisma.claseInstancia.findUnique({ where: { id: nuevaInstanciaId } });
    if (!nuevaInstancia) throw new Error("Clase destino no encontrada");

    // Misma zona
    if (nuevaInstancia.zona !== reserva.instancia.zona) {
      throw new Error("El cambio solo está permitido dentro del mismo grupo muscular (zona)");
    }

    // Mismo día calendario
    const fechaOrig  = reserva.instancia.fecha;
    const fechaNueva = nuevaInstancia.fecha;
    const mismoDia =
      fechaOrig.getFullYear() === fechaNueva.getFullYear() &&
      fechaOrig.getMonth()    === fechaNueva.getMonth()    &&
      fechaOrig.getDate()     === fechaNueva.getDate();
    if (!mismoDia) throw new Error("El cambio solo está permitido dentro del mismo día");

    // Cupo disponible en la nueva instancia (sin contar la propia reserva del cliente)
    const cuposOcupados = await prisma.reserva.count({
      where: {
        instanciaId: nuevaInstanciaId,
        estado:      { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] },
      },
    });
    if (cuposOcupados >= nuevaInstancia.cupoMaximo) {
      throw new Error("No hay cupos disponibles en la clase destino");
    }

    // ¿Ya tiene reserva activa en la nueva instancia? (no debería por la partial unique pero por las dudas)
    const reservaDestino = await prisma.reserva.findFirst({
      where: {
        clienteId,
        instanciaId: nuevaInstanciaId,
        estado: { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] },
      },
    });
    if (reservaDestino) throw new Error("Ya tenés una reserva activa en la clase destino");

    // Mover la reserva
    const reservaActualizada = await prisma.reserva.update({
      where: { id: reservaId },
      data:  { instanciaId: nuevaInstanciaId },
    });

    // Notificar a la cola de la instancia original (se liberó un cupo)
    await colaService.notificarPrimero(reserva.instanciaId);

    // Enviar confirmación
    await mailReservaConfirmada(
      { nombre: reserva.cliente.nombre, email: reserva.cliente.email },
      { fecha: nuevaInstancia.fecha, zona: nuevaInstancia.zona }
    );

    return reservaActualizada;
  },

  // ─── INIT POINT (pago pendiente) ─────────────────────────────────
  // Genera una preferencia MP fresca para una reserva PENDIENTE_PAGO.
  // Útil cuando el link anterior expiró o el usuario quiere volver a pagar.

  async obtenerInitPoint(reservaId: number, clienteId: number) {
    const reserva = await prisma.reserva.findUnique({
      where:   { id: reservaId },
      include: { instancia: true },
    });
    if (!reserva)                              throw new Error("Reserva no encontrada");
    if (reserva.clienteId !== clienteId)       throw new Error("No tenés permiso");
    if (reserva.estado !== "PENDIENTE_PAGO")   throw new Error("Solo se puede obtener link de pago para reservas pendientes");

    const { instancia } = reserva;
    const monto = Math.round(Number(instancia.precio) * 0.5);

    const pref = await crearPreferencia({
      items: [{
        id:          `sena-${reserva.id}`,
        title:       `Seña - Clase ${instancia.zona} ${instancia.fecha.toLocaleDateString("es-AR")}`,
        unit_price:  monto,
        quantity:    1,
        currency_id: "ARS",
      }],
      external_reference: `sena-${reserva.id}`,
      expiresEnMinutos:   360,
      returnPath:         "/reservas",
    });

    await prisma.reserva.update({
      where: { id: reservaId },
      data:  { mpPrefId: pref.id },
    });

    return { initPoint: pref.init_point };
  },

  // ─── LISTAR RESERVAS ──────────────────────────────────────────────

  async listar(clienteId?: number, instanciaId?: number) {
    return prisma.reserva.findMany({
      where: {
        ...(clienteId   !== undefined && { clienteId }),
        ...(instanciaId !== undefined && { instanciaId }),
      },
      include: {
        instancia: {
          include: { profesor: { select: { id: true, nombre: true, apellido: true, imagenUrl: true } } },
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
          include: { profesor: { select: { id: true, nombre: true, apellido: true, imagenUrl: true } } },
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
