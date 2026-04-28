import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import { ok, created } from "../../utils/response";

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      created(res, result, "Usuario registrado correctamente");
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      ok(res, result, "Login exitoso");
    } catch (err) {
      next(err);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.forgotPassword(req.body.email);
      // Respuesta siempre exitosa — no revelamos si el email existe
      ok(res, null, "Si el email está registrado, recibirás un enlace para restablecer la contraseña");
    } catch (err) {
      next(err);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;
      await authService.resetPassword(token, password);
      ok(res, null, "Contraseña restablecida correctamente");
    } catch (err) {
      next(err);
    }
  },

  async verify2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, codigo } = req.body;
      const result = await authService.verify2FA(Number(userId), codigo);
      ok(res, result, "Verificación exitosa");
    } catch (err) {
      next(err);
    }
  },

  // El logout con JWT es stateless: el servidor no guarda tokens,
  // así que "invalidar" significa simplemente que el cliente descarta el token.
  // Si en el futuro se necesita invalidación real (ej: "cerrar todas las sesiones"),
  // se puede implementar una blacklist en Redis con el jti (JWT ID) del token
  // y verificarla en el middleware authenticateToken.
  logout(_req: Request, res: Response) {
    ok(res, null, "Sesión cerrada correctamente");
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const usuario = await authService.me(req.user!.id);
      ok(res, usuario);
    } catch (err) {
      next(err);
    }
  },
};
