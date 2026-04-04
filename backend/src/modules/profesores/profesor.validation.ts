import { z } from "zod";

export const crearProfesorSchema = z.object({
  nombre:   z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  dni:      z.string().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 dígitos numéricos"),
});

export const editarProfesorSchema = crearProfesorSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Se debe proveer al menos un campo para editar",
  });
