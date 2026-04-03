import { Response } from "express";

// Formato estándar de todas las respuestas de la API:
// { success, data?, message?, error? }

export function ok(res: Response, data: unknown, message?: string) {
  return res.status(200).json({ success: true, data, message });
}

export function created(res: Response, data: unknown, message?: string) {
  return res.status(201).json({ success: true, data, message });
}

export function badRequest(res: Response, error: string) {
  return res.status(400).json({ success: false, error });
}

export function unauthorized(res: Response, error = "No autorizado") {
  return res.status(401).json({ success: false, error });
}

export function forbidden(res: Response, error = "Acceso denegado") {
  return res.status(403).json({ success: false, error });
}

export function notFound(res: Response, error = "Recurso no encontrado") {
  return res.status(404).json({ success: false, error });
}

export function serverError(res: Response, error = "Error interno del servidor") {
  return res.status(500).json({ success: false, error });
}
