import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

// Middleware de validación de body con Zod.
// Si el schema falla, lanza un ZodError que el errorHandler captura.
// Uso: router.post("/ruta", validate(MiSchema), handler)
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // parse() lanza ZodError si la validación falla
    req.body = schema.parse(req.body);
    next();
  };
}
