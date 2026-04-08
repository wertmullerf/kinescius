import { z } from "zod";

export const abonoPresencialSchema = z.object({
  clienteId:      z.number({ required_error: "clienteId es requerido" }).int().positive(),
  cantidadClases: z.number({ required_error: "cantidadClases es requerido" }).int().min(1),
  monto:          z.number({ required_error: "monto es requerido" }).positive(),
  metodo:         z.enum(["EFECTIVO", "TRANSFERENCIA", "MERCADO_PAGO"]),
  referencia:     z.string().optional(),
});

export const abonoMpSchema = z.object({
  cantidadClases: z.number({ required_error: "cantidadClases es requerido" }).int().min(1),
  monto:          z.number({ required_error: "monto es requerido" }).positive(),
});

export const complementoSchema = z.object({
  metodo:     z.enum(["EFECTIVO", "TRANSFERENCIA", "MERCADO_PAGO"]),
  referencia: z.string().optional(),
});

export type AbonoPresencialDto = z.infer<typeof abonoPresencialSchema>;
export type AbonoMpDto         = z.infer<typeof abonoMpSchema>;
export type ComplementoDto     = z.infer<typeof complementoSchema>;
