import { z } from "zod";

export const crearReservaSchema = z.object({
  instanciaId: z.number({ required_error: "instanciaId es requerido" }).int().positive(),
});

export const cambiarClaseSchema = z.object({
  nuevaInstanciaId: z.number({ required_error: "nuevaInstanciaId es requerido" }).int().positive(),
});

export type CrearReservaDto  = z.infer<typeof crearReservaSchema>;
export type CambiarClaseDto  = z.infer<typeof cambiarClaseSchema>;
