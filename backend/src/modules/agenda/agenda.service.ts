import { prisma } from "../../db/prisma";

export const agendaService = {
  async listar() {
    return prisma.agendaMensual.findMany({
      include: {
        _count: { select: { clases: true } },
      },
      orderBy: [{ anio: "desc" }, { mes: "desc" }],
    });
  },

  async obtener(id: number) {
    const agenda = await prisma.agendaMensual.findUnique({
      where: { id },
      include: {
        clases: {
          include: {
            profesor: { select: { id: true, nombre: true, apellido: true } },
            _count: { select: { instancias: true } },
          },
          orderBy: [{ diaSemana: "asc" }, { hora: "asc" }],
        },
      },
    });
    if (!agenda) throw new Error("Agenda no encontrada");
    return agenda;
  },

  async crear(data: { mes: number; anio: number }) {
    const existe = await prisma.agendaMensual.findUnique({
      where: { mes_anio: { mes: data.mes, anio: data.anio } },
    });
    if (existe) {
      throw new Error(`Ya existe una agenda para ${data.mes}/${data.anio}`);
    }
    return prisma.agendaMensual.create({ data });
  },

  async eliminar(id: number) {
    const agenda = await this.obtener(id);

    // Verificar si alguna instancia de esta agenda tiene reservas
    const reservasCount = await prisma.reserva.count({
      where: { instancia: { recurrente: { agendaId: id } } },
    });
    if (reservasCount > 0) {
      throw new Error(
        `No se puede eliminar la agenda porque tiene ${reservasCount} reserva(s) activa(s) en sus clases`
      );
    }

    // Eliminar en cascada: instancias → patrones → agenda
    await prisma.$transaction(async (tx) => {
      await tx.claseInstancia.deleteMany({
        where: { recurrente: { agendaId: id } },
      });
      await tx.claseRecurrente.deleteMany({ where: { agendaId: id } });
      await tx.agendaMensual.delete({ where: { id } });
    });

    return agenda;
  },
};
