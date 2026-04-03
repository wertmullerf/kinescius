import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { unauthorized, forbidden } from "../utils/response";

interface JwtPayload {
  id: number;
  email: string;
  rol: "ADMIN" | "PROFESOR" | "CLIENTE";
  tipoCliente: "ABONADO" | "NO_ABONADO";
}

// Verifica que el request tenga un JWT válido en Authorization: Bearer <token>.
// Si es válido, adjunta el payload a req.user para que los controladores lo usen.
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    unauthorized(res, "Token no proporcionado");
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.jwt.secret) as JwtPayload;
    req.user = {
      id: payload.id,
      email: payload.email,
      rol: payload.rol,
      tipoCliente: payload.tipoCliente,
    };
    next();
  } catch {
    unauthorized(res, "Token inválido o expirado");
  }
}

// Verifica que el usuario autenticado tenga alguno de los roles indicados.
// Siempre se usa después de authenticateToken.
// Ejemplo: router.get('/ruta', authenticateToken, authorizeRoles('ADMIN'), handler)
export function authorizeRoles(...roles: ("ADMIN" | "PROFESOR" | "CLIENTE")[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.rol)) {
      forbidden(res);
      return;
    }
    next();
  };
}
