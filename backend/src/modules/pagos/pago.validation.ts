import { z } from "zod";

export const tarjetaSchema = z.object({
  numero:          z.string().min(15).max(16),
  cvv:             z.string().min(3).max(4),
  fechaExpiracion: z.string().regex(/^\d{2}\/\d{2}$/, "Formato MM/YY"),
  titular:         z.string().min(2),
});

export const abonoPresencialSchema = z.object({
  clienteId:      z.number().int().positive(),
  cantidadClases: z.number().int().min(1),
  precioPorClase: z.number().positive(),
  metodo:         z.enum(["EFECTIVO", "TRANSFERENCIA", "MERCADO_PAGO", "TARJETA"]),
  referencia:     z.string().optional(),
});

export const abonoMpSchema = z.object({
  cantidadClases: z.number().int().min(1),
  precioPorClase: z.number().positive(),
});

export const abonoTarjetaSchema = z.object({
  cantidadClases: z.number().int().min(1),
  precioPorClase: z.number().positive(),
  tarjeta:        tarjetaSchema,
});

export const complementoSchema = z.object({
  metodo:     z.enum(["EFECTIVO", "TRANSFERENCIA", "MERCADO_PAGO", "TARJETA"]),
  referencia: z.string().optional(),
});

export type TarjetaDto         = z.infer<typeof tarjetaSchema>;
export type AbonoPresencialDto = z.infer<typeof abonoPresencialSchema>;
export type AbonoMpDto         = z.infer<typeof abonoMpSchema>;
export type AbonoTarjetaDto    = z.infer<typeof abonoTarjetaSchema>;
export type ComplementoDto     = z.infer<typeof complementoSchema>;
