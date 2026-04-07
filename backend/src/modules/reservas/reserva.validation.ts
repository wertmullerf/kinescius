import { z } from "zod";

export const crearReservaSchema = z.object({
  instanciaId: z.number({ required_error: "instanciaId es requerido" }).int().positive(),
});

export type CrearReservaDto = z.infer<typeof crearReservaSchema>;
