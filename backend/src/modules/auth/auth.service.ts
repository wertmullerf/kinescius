import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { mailRestablecerContrasenia, mail2FACode } from "../../utils/mailer";

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

    // 2FA obligatorio para administradores
    if (usuario.rol === "ADMIN") {
      const codigo = Math.floor(100000 + Math.random() * 900000).toString();
      const codigoHash = await bcrypt.hash(codigo, 10);
      const expira = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { twoFactorCode: codigoHash, twoFactorExpires: expira },
      });

      await mail2FACode({ nombre: usuario.nombre, email: usuario.email }, codigo);

      return { requires2FA: true as const, userId: usuario.id };
    }

    const { password: _, twoFactorCode: __, twoFactorExpires: ___, ...usuarioSinPassword } = usuario;
    const token = generarToken(usuario);

    return { usuario: usuarioSinPassword, token };
  },

  async verify2FA(userId: number, codigo: string) {
    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });

    if (!usuario || !usuario.twoFactorCode || !usuario.twoFactorExpires) {
      throw new Error("Código inválido");
    }

    if (new Date() > usuario.twoFactorExpires) {
      throw new Error("El código expiró. Iniciá sesión nuevamente");
    }

    const codigoOk = await bcrypt.compare(codigo, usuario.twoFactorCode);
    if (!codigoOk) throw new Error("Código incorrecto");

    // Limpiar código una vez usado (single-use)
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { twoFactorCode: null, twoFactorExpires: null },
    });

    const { password: _, twoFactorCode: __, twoFactorExpires: ___, ...usuarioSinPassword } = usuario;
    const token = generarToken(usuario);

    return { usuario: usuarioSinPassword, token };
  },

  async forgotPassword(email: string) {
    // No revelamos si el email existe o no (seguridad)
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) return; // silencioso

    // Token de un solo uso: incluye fragmento del hash actual.
    // Si el usuario ya cambió la contraseña, el hash ya no coincide → token inválido.
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, ph: usuario.password.slice(-8) },
      env.jwt.secret,
      { expiresIn: "1h" }
    );

    const resetLink = `${env.mp.frontendUrl}/reset-password?token=${token}`;
    await mailRestablecerContrasenia({ nombre: usuario.nombre, email: usuario.email }, resetLink);
  },

  async resetPassword(token: string, newPassword: string) {
    let payload: { id: number; email: string; ph: string };
    try {
      payload = jwt.verify(token, env.jwt.secret) as typeof payload;
    } catch {
      throw new Error("El enlace es inválido o expiró");
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: payload.id } });
    if (!usuario) throw new Error("Usuario no encontrado");

    // Verificar que el token no fue ya usado (hash no cambió)
    if (usuario.password.slice(-8) !== payload.ph) {
      throw new Error("El enlace ya fue utilizado");
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.usuario.update({ where: { id: usuario.id }, data: { password: hash } });
  },

  async me(id: number) {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id:                true,
        nombre:            true,
        apellido:          true,
        dni:               true,
        email:             true,
        rol:               true,
        tipoCliente:       true,
        clasesDisponibles: true,
        sancionado:        true,
        saldoFavor:        true,
        createdAt:         true,
        // password y campos 2FA excluidos explícitamente
      },
    });

    if (!usuario) throw new Error("Usuario no encontrado");

    return usuario;
  },
};
