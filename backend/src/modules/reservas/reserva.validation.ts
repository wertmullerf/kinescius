import { z } from "zod";
import { tarjetaSchema } from "../pagos/pago.validation";

export const crearReservaSchema = z.object({
  instanciaId: z.number({ required_error: "instanciaId es requerido" }).int().positive(),
  tarjeta:     tarjetaSchema.optional(), // presente solo cuando el cliente elige pagar con tarjeta
});

export const cambiarClaseSchema = z.object({
  nuevaInstanciaId: z.number({ required_error: "nuevaInstanciaId es requerido" }).int().positive(),
});

export type CrearReservaDto  = z.infer<typeof crearReservaSchema>;
export type CambiarClaseDto  = z.infer<typeof cambiarClaseSchema>;
