import { prisma } from "../../db/prisma";
import bcrypt from "bcryptjs";

export const usuariosService = {

  // ─── LISTAR CLIENTES ──────────────────────────────────────────────────────
  // Devuelve todos los usuarios con rol CLIENTE.
  // Filtros opcionales: nombre/apellido/dni/email (búsqueda parcial), tipoCliente, sancionado.

  async listar(filtros: {
    busqueda?:    string;
    tipoCliente?: "ABONADO" | "NO_ABONADO";
    sancionado?:  boolean;
  }) {
    return prisma.usuario.findMany({
      where: {
        rol: "CLIENTE",
        ...(filtros.tipoCliente && { tipoCliente: filtros.tipoCliente }),
        ...(filtros.sancionado  !== undefined && { sancionado: filtros.sancionado }),
        ...(filtros.busqueda && {
          OR: [
            { nombre:   { contains: filtros.busqueda, mode: "insensitive" } },
            { apellido: { contains: filtros.busqueda, mode: "insensitive" } },
            { dni:      { contains: filtros.busqueda, mode: "insensitive" } },
            { email:    { contains: filtros.busqueda, mode: "insensitive" } },
          ],
        }),
      },
      select: {
        id:                true,
        nombre:            true,
        apellido:          true,
        dni:               true,
        email:             true,
        tipoCliente:       true,
        clasesDisponibles: true,
        sancionado:        true,
        createdAt:         true,
      },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    });
  },

  // ─── OBTENER CLIENTE ──────────────────────────────────────────────────────
  // Incluye historial de reservas y pagos.

  async obtener(id: number) {
    const usuario = await prisma.usuario.findUnique({
      where: { id, rol: "CLIENTE" },
      select: {
        id:                true,
        nombre:            true,
        apellido:          true,
        dni:               true,
        email:             true,
        tipoCliente:       true,
        clasesDisponibles: true,
        sancionado:        true,
        createdAt:         true,
        reservas: {
          orderBy: { createdAt: "desc" },
          take:    20,
          select: {
            id:          true,
            estado:      true,
            montoPagado: true,
            createdAt:   true,
            instancia: {
              select: { id: true, fecha: true, zona: true },
            },
          },
        },
      },
    });
    if (!usuario) throw new Error("Cliente no encontrado");
    return usuario;
  },

  // ─── EDITAR CLIENTE ───────────────────────────────────────────────────────

  async editar(id: number, data: {
    nombre?:    string;
    apellido?:  string;
    dni?:       string;
    email?:     string;
    password?:  string;
    sancionado?: boolean;
  }) {
    const cliente = await prisma.usuario.findUnique({ where: { id, rol: "CLIENTE" } });
    if (!cliente) throw new Error("Cliente no encontrado");

    // Verificar unicidad de DNI y email si cambiaron
    if (data.dni && data.dni !== cliente.dni) {
      const existe = await prisma.usuario.findUnique({ where: { dni: data.dni } });
      if (existe) throw new Error("Ya existe un usuario con ese DNI");
    }
    if (data.email && data.email !== cliente.email) {
      const existe = await prisma.usuario.findUnique({ where: { email: data.email } });
      if (existe) throw new Error("Ya existe un usuario con ese email");
    }

    const updateData: {
      nombre?:    string;
      apellido?:  string;
      dni?:       string;
      email?:     string;
      password?:  string;
      sancionado?: boolean;
    } = {};

    if (data.nombre    !== undefined) updateData.nombre    = data.nombre;
    if (data.apellido  !== undefined) updateData.apellido  = data.apellido;
    if (data.dni       !== undefined) updateData.dni       = data.dni;
    if (data.email     !== undefined) updateData.email     = data.email;
    if (data.sancionado !== undefined) updateData.sancionado = data.sancionado;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    return prisma.usuario.update({
      where: { id },
      data:  updateData,
      select: {
        id:                true,
        nombre:            true,
        apellido:          true,
        dni:               true,
        email:             true,
        tipoCliente:       true,
        clasesDisponibles: true,
        sancionado:        true,
      },
    });
  },

  // ─── ELIMINAR CLIENTE ─────────────────────────────────────────────────────
  // Solo se permite si no tiene reservas activas.

  async eliminar(id: number) {
    const cliente = await prisma.usuario.findUnique({ where: { id, rol: "CLIENTE" } });
    if (!cliente) throw new Error("Cliente no encontrado");

    const reservaActiva = await prisma.reserva.findFirst({
      where: {
        clienteId: id,
        estado:    { in: ["PENDIENTE_PAGO", "RESERVA_PAGA", "CONFIRMADA"] },
      },
    });
    if (reservaActiva) throw new Error("El cliente tiene reservas activas y no puede eliminarse");

    await prisma.usuario.delete({ where: { id } });
  },
};
