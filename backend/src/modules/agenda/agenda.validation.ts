import { z } from "zod";

export const crearAgendaSchema = z.object({
  mes:  z.number().int().min(1, "El mes debe estar entre 1 y 12").max(12, "El mes debe estar entre 1 y 12"),
  anio: z.number().int().min(2024, "El año debe ser 2024 o posterior"),
});
