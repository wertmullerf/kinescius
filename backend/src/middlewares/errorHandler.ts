import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Error de validación Zod → 400
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: "Datos inválidos",
      details: err.errors.map((e) => ({
        campo: e.path.join("."),
        mensaje: e.message,
      })),
    });
    return;
  }

  // Errores conocidos de Prisma
  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      res.status(404).json({ success: false, error: "Recurso no encontrado" });
      return;
    }
    if (err.code === "P2002") {
      res.status(409).json({ success: false, error: "Ya existe un registro con esos datos" });
      return;
    }
  }

  // Error genérico con mensaje
  if (err instanceof Error) {
    console.error("[ERROR]", err.message);
    res.status(500).json({ success: false, error: err.message });
    return;
  }

  console.error("[ERROR desconocido]", err);
  res.status(500).json({ success: false, error: "Error interno del servidor" });
}
