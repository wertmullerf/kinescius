import { prisma } from "../../db/prisma";
import { ZonaClase } from "../../types/models";
import { parseHora, formatHora, generarFechasDelMes } from "../../utils/clases";

// ─── Includes reutilizados ────────────────────────────────────────────────────

const includePatron = {
  profesor: { select: { id: true, nombre: true, apellido: true } },
  _count: { select: { instancias: true } },
} as const;

const includeInstancia = {
  profesor: { select: { id: true, nombre: true, apellido: true } },
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
      precio: number;
      profesorId: number;
    }
  ) {
    const agenda = await prisma.agendaMensual.findUnique({ where: { id: agendaId } });
    if (!agenda) throw new Error("Agenda no encontrada");

    const profesor = await prisma.profesor.findUnique({ where: { id: data.profesorId } });
    if (!profesor) throw new Error("Profesor no encontrado");

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
          duracion:   60,
          precio:     data.precio,
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
      precio?:     number;
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
            ...(data.precio     !== undefined && { precio:     data.precio }),
            ...(data.profesorId !== undefined && { profesorId: data.profesorId }),
          },
        });

        if (nuevasFechas.length > 0) {
          await tx.claseInstancia.createMany({
            data: nuevasFechas.map((fecha) => ({
              fecha,
              zona:         patronActualizado.zona,
              cupoMaximo:   patronActualizado.cupoMaximo,
              duracion:     patronActualizado.duracion,
              precio:       patronActualizado.precio,
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

      await prisma.$transaction(async (tx) => {
        await tx.claseRecurrente.update({
          where: { id },
          data: {
            ...(data.zona       !== undefined && { zona:       data.zona }),
            ...(data.cupoMaximo !== undefined && { cupoMaximo: data.cupoMaximo }),
            ...(data.precio     !== undefined && { precio:     data.precio }),
            ...(data.profesorId !== undefined && { profesorId: data.profesorId }),
          },
        });

        // Propagar solo a instancias que no son excepción
        await tx.claseInstancia.updateMany({
          where: { recurrenteId: id, esExcepcion: false },
          data: {
            ...(data.zona       !== undefined && { zona:       data.zona }),
            ...(data.cupoMaximo !== undefined && { cupoMaximo: data.cupoMaximo }),
            ...(data.precio     !== undefined && { precio:     data.precio }),
            ...(data.profesorId !== undefined && { profesorId: data.profesorId }),
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

  async listarInstancias(agendaId: number) {
    const agenda = await prisma.agendaMensual.findUnique({ where: { id: agendaId } });
    if (!agenda) throw new Error("Agenda no encontrada");

    return prisma.claseInstancia.findMany({
      where: { recurrente: { agendaId } },
      include: includeInstancia,
      orderBy: { fecha: "asc" },
    });
  },

  async editarInstancia(
    id: number,
    data: {
      zona?:            ZonaClase;
      cupoMaximo?:      number;
      precio?:          number;
      profesorId?:      number;
      motivoExcepcion:  string;
    }
  ) {
    const instancia = await prisma.claseInstancia.findUnique({ where: { id } });
    if (!instancia) throw new Error("Instancia no encontrada");

    if (data.profesorId !== undefined && data.profesorId !== instancia.profesorId) {
      await checkConflictoProfesor(data.profesorId, [instancia.fecha], id);
    }

    return prisma.claseInstancia.update({
      where: { id },
      data: {
        esExcepcion:     true,
        motivoExcepcion: data.motivoExcepcion,
        ...(data.zona       !== undefined && { zona:       data.zona }),
        ...(data.cupoMaximo !== undefined && { cupoMaximo: data.cupoMaximo }),
        ...(data.precio     !== undefined && { precio:     data.precio }),
        ...(data.profesorId !== undefined && { profesorId: data.profesorId }),
      },
      include: includeInstancia,
    });
  },

  async cancelarInstancia(id: number) {
    const instancia = await prisma.claseInstancia.findUnique({
      where: { id },
      include: { _count: { select: { reservas: true } } },
    });
    if (!instancia) throw new Error("Instancia no encontrada");

    if (instancia._count.reservas > 0) {
      throw new Error(
        `No se puede cancelar la instancia porque tiene ${instancia._count.reservas} reserva(s) activa(s). Primero cancelá las reservas.`
      );
    }

    return prisma.claseInstancia.update({
      where: { id },
      data: { esExcepcion: true, motivoExcepcion: "CANCELADA" },
    });
  },

  // ── Instancias sueltas ──────────────────────────────────────────────────────

  async crearSuelta(data: {
    fecha:      string;
    zona:       ZonaClase;
    cupoMaximo: number;
    precio:     number;
    profesorId: number;
  }) {
    const profesor = await prisma.profesor.findUnique({ where: { id: data.profesorId } });
    if (!profesor) throw new Error("Profesor no encontrado");

    const fecha = new Date(data.fecha);
    await checkConflictoProfesor(data.profesorId, [fecha]);

    return prisma.claseInstancia.create({
      data: {
        fecha,
        zona:         data.zona,
        cupoMaximo:   data.cupoMaximo,
        duracion:     60,
        precio:       data.precio,
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
