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

  // ─── LISTADO GLOBAL (ADMIN) ───────────────────────────────────────────────
  // Filtro opcional por nombre/apellido/email del cliente.

  async listarTodas(q?: string) {
    return prisma.asistencia.findMany({
      where: q ? {
        reserva: {
          cliente: {
            OR: [
              { nombre:   { contains: q, mode: "insensitive" } },
              { apellido: { contains: q, mode: "insensitive" } },
              { email:    { contains: q, mode: "insensitive" } },
            ],
          },
        },
      } : undefined,
      include: {
        reserva: {
          include: {
            cliente:   { select: { id: true, nombre: true, apellido: true, email: true } },
            instancia: {
              select: {
                fecha:    true,
                zona:     true,
                profesor: { select: { nombre: true, apellido: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 150,
    });
  },

  // ─── CLASES DEL PROFESOR (para vista de asistencia manual) ──────────────────
  // Devuelve instancias del mes actual (y próximo mes si faltan menos de 7 días)
  // donde el profesor es el autenticado, con lista de reservas + estado asistencia.

  async misClases() {
    const ahora = new Date();
    // Rango: desde hace 2 días hasta 60 días adelante
    const desde = new Date(ahora);
    desde.setDate(desde.getDate() - 2);
    const hasta = new Date(ahora);
    hasta.setDate(hasta.getDate() + 60);

    return prisma.claseInstancia.findMany({
      where: {
        fecha: { gte: desde, lte: hasta },
      },
      include: {
        reservas: {
          where: { estado: { in: ["CONFIRMADA", "RESERVA_PAGA", "COMPLETADA"] } },
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
      orderBy: { fecha: "asc" },
    });
  },

  // ─── DAR PRESENTE (CLIENTE escanea QR) ───────────────────────────────────
  // El cliente escanea el QR de la clase y se marca presente a sí mismo.

  async darPresente(codigoQr: string, clienteId: number) {
    const instancia = await prisma.claseInstancia.findUnique({
      where: { codigoQr },
    });
    if (!instancia) throw new Error("Código QR inválido");

    const reserva = await prisma.reserva.findFirst({
      where: {
        instanciaId: instancia.id,
        clienteId,
        estado: { in: ["CONFIRMADA", "RESERVA_PAGA"] },
      },
    });
    if (!reserva) throw new Error("No tenés una reserva confirmada para esta clase");

    // Verificar que la clase no está demasiado lejos en el futuro (solo 2hs antes)
    const ahora = new Date();
    const diffMs = new Date(instancia.fecha).getTime() - ahora.getTime();
    const diffHoras = diffMs / (1000 * 60 * 60);
    if (diffHoras > 2) throw new Error("Solo podés dar presente hasta 2 horas antes de la clase");

    const [asistencia] = await prisma.$transaction([
      prisma.asistencia.upsert({
        where:  { reservaId: reserva.id },
        update: { presente: true, registradoPor: clienteId },
        create: { reservaId: reserva.id, presente: true, registradoPor: clienteId },
      }),
      prisma.reserva.update({
        where: { id: reserva.id },
        data:  { estado: "COMPLETADA" },
      }),
    ]);

    return asistencia;
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
