import { z } from "zod";

export const registerSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  dni: z.string().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 dígitos numéricos"),
  email: z.string().email("El email no es válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().email("El email no es válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});
