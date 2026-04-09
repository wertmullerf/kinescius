import { prisma } from "../../db/prisma";

export const asistenciaService = {

  // ─── OBTENER CLASE POR QR ──────────────────────────────────────────────────
  // El profesor escanea el QR de la clase y obtiene la lista de reservas activas.

  async obtenerPorQr(codigoQr: string) {
    const instancia = await prisma.claseInstancia.findUnique({
      where:   { codigoQr },
      include: {
        profesor: { select: { id: true, nombre: true, apellido: true } },
        reservas: {
          where: { estado: { in: ["CONFIRMADA", "RESERVA_PAGA"] } },
          select: {
            id:     true,
            estado: true,
            cliente: {
              select: { id: true, nombre: true, apellido: true, tipoCliente: true },
            },
            asistencia: { select: { id: true, presente: true } },
          },
          orderBy: [
            { cliente: { apellido: "asc" } },
            { cliente: { nombre:   "asc" } },
          ],
        },
      },
    });
    if (!instancia) throw new Error("Código QR inválido");
    return instancia;
  },

  // ─── MARCAR ASISTENCIA ────────────────────────────────────────────────────
  // Crea o actualiza el registro de asistencia de una reserva.
  // Si presente=true, la reserva pasa a COMPLETADA.
  // Si presente=false (faltó), también se cierra como COMPLETADA.

  async marcar(reservaId: number, presente: boolean, registradoPor: number) {
    const reserva = await prisma.reserva.findUnique({
      where: { id: reservaId },
    });
    if (!reserva) throw new Error("Reserva no encontrada");
    if (reserva.estado !== "CONFIRMADA" && reserva.estado !== "RESERVA_PAGA") {
      throw new Error("Solo se puede registrar asistencia en reservas confirmadas o pagas");
    }

    const [asistencia] = await prisma.$transaction([
      prisma.asistencia.upsert({
        where:  { reservaId },
        update: { presente, registradoPor },
        create: { reservaId, presente, registradoPor },
      }),
      prisma.reserva.update({
        where: { id: reservaId },
        data:  { estado: "COMPLETADA" },
      }),
    ]);

    return asistencia;
  },

  // ─── LISTADO POR CLASE ────────────────────────────────────────────────────
  // Vista completa de asistencia de una instancia (ADMIN).

  async listarPorClase(instanciaId: number) {
    const instancia = await prisma.claseInstancia.findUnique({
      where:   { id: instanciaId },
      include: {
        profesor: { select: { nombre: true, apellido: true } },
        reservas: {
          where: { estado: { in: ["CONFIRMADA", "RESERVA_PAGA", "COMPLETADA"] } },
          select: {
            id:     true,
            estado: true,
            cliente: {
              select: { id: true, nombre: true, apellido: true, tipoCliente: true },
            },
            asistencia: { select: { id: true, presente: true, createdAt: true } },
          },
          orderBy: [
            { cliente: { apellido: "asc" } },
            { cliente: { nombre:   "asc" } },
          ],
        },
      },
    });
    if (!instancia) throw new Error("Clase no encontrada");
    return instancia;
  },

  // ─── HISTORIAL DE ASISTENCIAS DE UN CLIENTE ───────────────────────────────

  async historialCliente(clienteId: number) {
    const cliente = await prisma.usuario.findUnique({
      where: { id: clienteId, rol: "CLIENTE" },
      select: { id: true, nombre: true, apellido: true },
    });
    if (!cliente) throw new Error("Cliente no encontrado");

    const reservas = await prisma.reserva.findMany({
      where:   { clienteId, estado: { in: ["COMPLETADA", "CONFIRMADA", "RESERVA_PAGA"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id:     true,
        estado: true,
        instancia: {
          select: { id: true, fecha: true, zona: true },
        },
        asistencia: { select: { presente: true } },
      },
    });

    return { cliente, reservas };
  },
};
