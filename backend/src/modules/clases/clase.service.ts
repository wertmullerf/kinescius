import { prisma } from "../../db/prisma";
import { ZonaClase } from "../../types/models";
import { parseHora, formatHora, generarFechasDelMes } from "../../utils/clases";
import { configuracionService } from "../configuracion/configuracion.service";
import { mailClaseModificada, mailInstanciaCancelada, mailSaldoAcreditado } from "../../utils/mailer";

async function getConfigClase(): Promise<{ precio: number; duracion: number }> {
  const [precioStr, minutosStr] = await Promise.all([
    configuracionService.obtener("precioClase"),
    configuracionService.obtener("minutosClase"),
  ]);
  return {
    precio:   Number(precioStr)  || 2000,
    duracion: Number(minutosStr) || 60,
  };
}

// ─── Includes reutilizados ────────────────────────────────────────────────────

const includePatron = {
  profesor: { select: { id: true, nombre: true, apellido: true } },
  _count: { select: { instancias: true } },
} as const;

const includeInstancia = {
  profesor: { select: { id: true, nombre: true, apellido: true, imagenUrl: true } },
  _count: { select: { reservas: true } },
} as const;

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Verifica que el profesor no tenga ya una clase en alguna de las fechas indicadas.
 * `excluirId` permite ignorar la propia instancia al editar.
 */
async function checkConflictoProfesor(
  profesorId: number,
  fechas: Date[],
  excluirInstanciaId?: number
): Promise<void> {
  const conflicto = await prisma.claseInstancia.findFirst({
    where: {
      profesorId,
      fecha: { in: fechas },
      ...(excluirInstanciaId !== undefined ? { NOT: { id: excluirInstanciaId } } : {}),
    },
    select: { fecha: true },
  });
  if (conflicto) {
    throw new Error(
      `El profesor ya tiene una clase el ${conflicto.fecha.toLocaleDateString("es-AR")} a esa hora`
    );
  }
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const claseService = {

  // ── Patrones recurrentes ────────────────────────────────────────────────────

  async listarPatrones(agendaId: number) {
    const agenda = await prisma.agendaMensual.findUnique({ where: { id: agendaId } });
    if (!agenda) throw new Error("Agenda no encontrada");

    return prisma.claseRecurrente.findMany({
      where: { agendaId },
      include: includePatron,
      orderBy: [{ diaSemana: "asc" }, { hora: "asc" }],
    });
  },

  async crearPatron(
    agendaId: number,
    data: {
      diaSemana: number;
      hora: string;
      zona: ZonaClase;
      cupoMaximo: number;
      profesorId: number;
    }
  ) {
    const agenda = await prisma.agendaMensual.findUnique({ where: { id: agendaId } });
    if (!agenda) throw new Error("Agenda no encontrada");

    const profesor = await prisma.profesor.findUnique({ where: { id: data.profesorId } });
    if (!profesor) throw new Error("Profesor no encontrado");

    const { precio, duracion } = await getConfigClase();

    const horaDate = parseHora(data.hora);
    const fechas = generarFechasDelMes(agenda.anio, agenda.mes, data.diaSemana, horaDate);

    // Validar conflictos de agenda del profesor antes de crear
    if (fechas.length > 0) {
      await checkConflictoProfesor(data.profesorId, fechas);
    }

    return prisma.$transaction(async (tx) => {
      const patron = await tx.claseRecurrente.create({
        data: {
          diaSemana:  data.diaSemana,
          hora:       horaDate,
          zona:       data.zona,
          cupoMaximo: data.cupoMaximo,
          duracion,
          precio,
          profesorId: data.profesorId,
          agendaId,
        },
      });

      if (fechas.length > 0) {
        await tx.claseInstancia.createMany({
          data: fechas.map((fecha) => ({
            fecha,
            zona:         patron.zona,
            cupoMaximo:   patron.cupoMaximo,
            duracion:     patron.duracion,
            precio:       patron.precio,
            profesorId:   patron.profesorId,
            recurrenteId: patron.id,
            esExcepcion:  false,
          })),
        });
      }

      return tx.claseRecurrente.findUnique({
        where: { id: patron.id },
        include: includePatron,
      });
    });
  },

  async editarPatron(
    agendaId: number,
    id: number,
    data: {
      diaSemana?:  number;
      hora?:       string;
      zona?:       ZonaClase;
      cupoMaximo?: number;
      profesorId?: number;
    }
  ) {
    const patron = await prisma.claseRecurrente.findFirst({ where: { id, agendaId } });
    if (!patron) throw new Error("Patrón no encontrado en esta agenda");

    if (data.profesorId !== undefined) {
      const profesor = await prisma.profesor.findUnique({ where: { id: data.profesorId } });
      if (!profesor) throw new Error("Profesor no encontrado");
    }

    const cambiaDia  = data.diaSemana !== undefined && data.diaSemana !== patron.diaSemana;
    const cambiaHora = data.hora !== undefined && data.hora !== formatHora(patron.hora);

    if (cambiaDia || cambiaHora) {
      // No se puede reprogramar si hay reservas en alguna instancia
      const reservasCount = await prisma.reserva.count({
        where: { instancia: { recurrenteId: id } },
      });
      if (reservasCount > 0) {
        throw new Error(
          "No se puede reprogramar el patrón porque tiene instancias con reservas activas"
        );
      }

      const { precio, duracion } = await getConfigClase();
      const agenda      = await prisma.agendaMensual.findUnique({ where: { id: agendaId } });
      const nuevoDia    = data.diaSemana  ?? patron.diaSemana;
      const nuevaHora   = data.hora       ? parseHora(data.hora) : patron.hora;
      const profesorId  = data.profesorId ?? patron.profesorId;
      const nuevasFechas = generarFechasDelMes(agenda!.anio, agenda!.mes, nuevoDia, nuevaHora);

      if (nuevasFechas.length > 0) {
        await checkConflictoProfesor(profesorId, nuevasFechas);
      }

      await prisma.$transaction(async (tx) => {
        // Ya verificamos que no hay reservas: eliminar todas las instancias
        await tx.claseInstancia.deleteMany({ where: { recurrenteId: id } });

        const patronActualizado = await tx.claseRecurrente.update({
          where: { id },
          data: {
            ...(data.diaSemana  !== undefined && { diaSemana:  data.diaSemana }),
            ...(data.hora       !== undefined && { hora:       nuevaHora }),
            ...(data.zona       !== undefined && { zona:       data.zona }),
            ...(data.cupoMaximo !== undefined && { cupoMaximo: data.cupoMaximo }),
            ...(data.profesorId !== undefined && { profesorId: data.profesorId }),
            precio,
            duracion,
          },
        });

        if (nuevasFechas.length > 0) {
          await tx.claseInstancia.createMany({
            data: nuevasFechas.map((fecha) => ({
              fecha,
              zona:         patronActualizado.zona,
              cupoMaximo:   patronActualizado.cupoMaximo,
              duracion,
              precio,
              profesorId:   patronActualizado.profesorId,
              recurrenteId: id,
              esExcepcion:  false,
            })),
          });
        }
      });
    } else {
      // Solo cambian campos de detalle: propagar a instancias no excepción
      if (data.profesorId !== undefined && data.profesorId !== patron.profesorId) {
        const instanciasNoExcepcion = await prisma.claseInstancia.findMany({
          where: { recurrenteId: id, esExcepcion: false },
          select: { fecha: true },
        });
        if (instanciasNoExcepcion.length > 0) {
          await checkConflictoProfesor(
            data.profesorId,
            instanciasNoExcepcion.map((i) => i.fecha)
          );
        }
      }

      const { precio, duracion } = await getConfigClase();

      await prisma.$transaction(async (tx) => {
        await tx.claseRecurrente.update({
          where: { id },
          data: {
            ...(data.zona       !== undefined && { zona:       data.zona }),
            ...(data.cupoMaximo !== undefined && { cupoMaximo: data.cupoMaximo }),
            ...(data.profesorId !== undefined && { profesorId: data.profesorId }),
            precio,
            duracion,
          },
        });

        // Propagar solo a instancias que no son excepción
        await tx.claseInstancia.updateMany({
          where: { recurrenteId: id, esExcepcion: false },
          data: {
            ...(data.zona       !== undefined && { zona:       data.zona }),
            ...(data.cupoMaximo !== undefined && { cupoMaximo: data.cupoMaximo }),
            ...(data.profesorId !== undefined && { profesorId: data.profesorId }),
            precio,
            duracion,
          },
        });
      });
    }

    return prisma.claseRecurrente.findUnique({
      where: { id },
      include: includePatron,
    });
  },

  async eliminarPatron(agendaId: number, id: number) {
    const patron = await prisma.claseRecurrente.findFirst({ where: { id, agendaId } });
    if (!patron) throw new Error("Patrón no encontrado en esta agenda");

    const reservasCount = await prisma.reserva.count({
      where: { instancia: { recurrenteId: id } },
    });
    if (reservasCount > 0) {
      throw new Error(
        `No se puede eliminar el patrón porque tiene ${reservasCount} reserva(s) activa(s) en sus instancias`
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.claseInstancia.deleteMany({ where: { recurrenteId: id } });
      await tx.claseRecurrente.delete({ where: { id } });
    });
  },

  // ── Instancias del mes ──────────────────────────────────────────────────────

  async listarInstancias(
    agendaId: number,
    filters?: { fecha?: string; zona?: ZonaClase }
  ) {
    const agenda = await prisma.agendaMensual.findUnique({ where: { id: agendaId } });
    if (!agenda) throw new Error("Agenda no encontrada");

    // Rango del mes completo para incluir clases sueltas del mismo mes
    const mesInicio = new Date(Date.UTC(agenda.anio, agenda.mes - 1, 1));
    const mesFin    = new Date(Date.UTC(agenda.anio, agenda.mes,     1));

    // Filtro por fecha: rango del día completo en UTC
    let fechaFiltro: { gte: Date; lt: Date } | undefined;
    if (filters?.fecha) {
      const inicio = new Date(`${filters.fecha}T00:00:00.000Z`);
      const fin    = new Date(`${filters.fecha}T23:59:59.999Z`);
      fechaFiltro  = { gte: inicio, lt: fin };
    }

    const instancias = await prisma.claseInstancia.findMany({
      where: {
        OR: [
          { recurrente: { agendaId } },
          { recurrenteId: null, fecha: { gte: mesInicio, lt: mesFin } },
        ],
        ...(fechaFiltro   && { fecha: fechaFiltro }),
        ...(filters?.zona && { zona: filters.zona }),
      },
      include: {
        profesor: { select: { id: true, nombre: true, apellido: true, imagenUrl: true } },
        _count: {
          select: {
            reservas: {
              where: { estado: { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] } },
            },
          },
        },
      },
      orderBy: { fecha: "asc" },
    });

    return instancias.map(({ _count, ...rest }) => ({
      ...rest,
      reservasActivas: _count.reservas,
      cancelada: rest.motivoExcepcion === "CANCELADA",
    }));
  },

  async editarInstancia(
    id: number,
    data: {
      fecha?:           Date;
      zona?:            ZonaClase;
      profesorId?:      number;
      motivoExcepcion:  string;
    }
  ) {
    const instancia = await prisma.claseInstancia.findUnique({ where: { id } });
    if (!instancia) throw new Error("Instancia no encontrada");

    // Si cambia fecha o profesor, verificar que no haya conflicto
    const fechaFinal    = data.fecha      ?? instancia.fecha;
    const profesorFinal = data.profesorId ?? instancia.profesorId;
    if (data.fecha !== undefined || data.profesorId !== undefined) {
      await checkConflictoProfesor(profesorFinal, [fechaFinal], id);
    }

    const { precio, duracion } = await getConfigClase();

    const updated = await prisma.claseInstancia.update({
      where: { id },
      data: {
        esExcepcion:     true,
        motivoExcepcion: data.motivoExcepcion,
        precio,
        duracion,
        ...(data.fecha      !== undefined && { fecha:      data.fecha }),
        ...(data.zona       !== undefined && { zona:       data.zona }),
        ...(data.profesorId !== undefined && { profesorId: data.profesorId }),
      },
      include: includeInstancia,
    });

    // Notificar a todos los clientes con reservas activas
    const reservas = await prisma.reserva.findMany({
      where: {
        instanciaId: id,
        estado: { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] },
      },
      include: { cliente: { select: { nombre: true, email: true } } },
    });
    for (const r of reservas) {
      mailClaseModificada(r.cliente, {
        fechaAnterior: instancia.fecha,
        fechaNueva:    updated.fecha,
        zona:          updated.zona,
        motivo:        data.motivoExcepcion,
      }).catch(() => {});
    }

    return updated;
  },

  async cancelarInstancia(id: number) {
    const instancia = await prisma.claseInstancia.findUnique({ where: { id } });
    if (!instancia) throw new Error("Instancia no encontrada");

    const reservas = await prisma.reserva.findMany({
      where: {
        instanciaId: id,
        estado: { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] },
      },
      include: { cliente: true },
    });

    // Transacción interactiva para manejar créditos individuales por reserva
    await prisma.$transaction(async (tx) => {
      // 1. Cancelar todas las reservas activas y marcar la instancia
      await tx.reserva.updateMany({
        where: { instanciaId: id, estado: { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] } },
        data:  { estado: "CANCELADA" },
      });
      await tx.claseInstancia.update({
        where: { id },
        data:  { esExcepcion: true, motivoExcepcion: "CANCELADA" },
      });

      for (const reserva of reservas) {
        // 2. ABONADO (CONFIRMADA): devolver la clase al saldo de clases
        if (reserva.estado === "CONFIRMADA") {
          await tx.usuario.update({
            where: { id: reserva.clienteId },
            data:  { clasesDisponibles: { increment: 1 } },
          });
        }

        // 3. NO ABONADO (RESERVA_PAGA): acreditar monto como saldo monetario
        if (reserva.estado === "RESERVA_PAGA" && Number(reserva.montoPagado) > 0) {
          await tx.usuario.update({
            where: { id: reserva.clienteId },
            data:  { saldoFavor: { increment: reserva.montoPagado } },
          });
          await tx.movimientoSaldo.create({
            data: {
              clienteId:   reserva.clienteId,
              monto:       reserva.montoPagado,
              tipo:        "ACREDITADO_CANCELACION_CLASE",
              descripcion: `Clase cancelada por el centro: ${instancia.zona} · ${instancia.fecha.toLocaleDateString("es-AR")}`,
              reservaId:   reserva.id,
            },
          });
        }
      }
    });

    // Notificaciones por email (fire-and-forget)
    for (const r of reservas) {
      if (r.estado === "RESERVA_PAGA" && Number(r.montoPagado) > 0) {
        mailSaldoAcreditado(r.cliente, {
          monto:    Number(r.montoPagado),
          motivo:   "El centro canceló una clase en la que tenías una reserva paga. Te acreditamos el monto como saldo a favor.",
          instancia: { fecha: instancia.fecha, zona: instancia.zona },
        }).catch(() => {});
      } else {
        mailInstanciaCancelada(r.cliente, { fecha: instancia.fecha, zona: instancia.zona }).catch(() => {});
      }
    }

    return { canceladas: reservas.length };
  },

  // ── Instancias sueltas ──────────────────────────────────────────────────────

  async crearSuelta(data: {
    fecha:      string;
    zona:       ZonaClase;
    cupoMaximo: number;
    profesorId: number;
  }) {
    const profesor = await prisma.profesor.findUnique({ where: { id: data.profesorId } });
    if (!profesor) throw new Error("Profesor no encontrado");

    const { precio, duracion } = await getConfigClase();

    const fecha = new Date(data.fecha);
    await checkConflictoProfesor(data.profesorId, [fecha]);

    return prisma.claseInstancia.create({
      data: {
        fecha,
        zona:         data.zona,
        cupoMaximo:   data.cupoMaximo,
        duracion,
        precio,
        profesorId:   data.profesorId,
        recurrenteId: null,
        esExcepcion:  false,
      },
      include: includeInstancia,
    });
  },

  async eliminarSuelta(id: number) {
    const instancia = await prisma.claseInstancia.findUnique({
      where: { id },
      include: { _count: { select: { reservas: true } } },
    });
    if (!instancia) throw new Error("Instancia no encontrada");

    if (instancia.recurrenteId !== null) {
      throw new Error(
        "Esta instancia pertenece a un patrón recurrente. Para eliminarla, eliminá el patrón."
      );
    }
    if (instancia._count.reservas > 0) {
      throw new Error(
        `No se puede eliminar la clase suelta porque tiene ${instancia._count.reservas} reserva(s) activa(s)`
      );
    }

    return prisma.claseInstancia.delete({ where: { id } });
  },
};
