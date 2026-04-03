import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";

// ─── Tipos internos ───────────────────────────────────────────────

interface RegisterInput {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  password: string;
  // tipoCliente no viene del usuario: siempre inicia como NO_ABONADO (default del schema)
}

interface LoginInput {
  email: string;
  password: string;
}

// ─── Helper ───────────────────────────────────────────────────────

// Genera un JWT con el payload del usuario.
// Expira en 8 horas (acorde al horario laboral del centro).
function generarToken(usuario: {
  id: number;
  email: string;
  rol: string;
  tipoCliente: "ABONADO" | "NO_ABONADO";
}): string {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      tipoCliente: usuario.tipoCliente,
    },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn as jwt.SignOptions["expiresIn"] }
  );
}

// ─── Servicio ─────────────────────────────────────────────────────

export const authService = {
  // Solo los clientes pueden registrarse desde la API.
  // El ADMIN y el PROFESOR se crean por seed, no por registro.
  async register(data: RegisterInput) {
    // Verificar unicidad de email y DNI por separado para dar mensajes claros
    const emailExiste = await prisma.usuario.findUnique({ where: { email: data.email } });
    if (emailExiste) throw new Error("El email ya está registrado");

    const dniExiste = await prisma.usuario.findUnique({ where: { dni: data.dni } });
    if (dniExiste) throw new Error("El DNI ya está registrado");

    const hash = await bcrypt.hash(data.password, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nombre: data.nombre,
        apellido: data.apellido,
        dni: data.dni,
        email: data.email,
        password: hash,
        rol: "CLIENTE",
        // tipoCliente no se asigna: Prisma usa el default NO_ABONADO del schema
      },
    });

    const { password: _, ...usuarioSinPassword } = usuario;
    const token = generarToken(usuario);

    return { usuario: usuarioSinPassword, token };
  },

  async login({ email, password }: LoginInput) {
    const usuario = await prisma.usuario.findUnique({ where: { email } });

    // Usamos el mismo mensaje para email y password incorrectos
    // para no revelar si el email existe o no (seguridad básica)
    if (!usuario) throw new Error("Credenciales incorrectas");

    const passwordOk = await bcrypt.compare(password, usuario.password);
    if (!passwordOk) throw new Error("Credenciales incorrectas");

    const { password: _, ...usuarioSinPassword } = usuario;
    const token = generarToken(usuario);

    return { usuario: usuarioSinPassword, token };
  },

  async me(id: number) {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        dni: true,
        email: true,
        rol: true,
        tipoCliente: true,
        createdAt: true,
        // password excluido explícitamente
      },
    });

    if (!usuario) throw new Error("Usuario no encontrado");

    return usuario;
  },
};
