import { z } from "zod";
import { ZonaClase } from "../../types/models";

export const crearPatronSchema = z.object({
  diaSemana: z.number().int().min(0, "diaSemana debe ser 0–6").max(6, "diaSemana debe ser 0–6"),
  hora:      z.string().regex(/^\d{2}:\d{2}$/, "Formato requerido: HH:mm"),
  zona:      z.nativeEnum(ZonaClase, { errorMap: () => ({ message: "Zona inválida" }) }),
  cupoMaximo: z.number().int().positive("El cupo debe ser mayor a 0"),
  precio:     z.number().positive("El precio debe ser mayor a 0"),
  profesorId: z.number().int().positive("profesorId inválido"),
});

export const editarPatronSchema = z
  .object({
    diaSemana:  z.number().int().min(0).max(6).optional(),
    hora:       z.string().regex(/^\d{2}:\d{2}$/, "Formato requerido: HH:mm").optional(),
    zona:       z.nativeEnum(ZonaClase).optional(),
    cupoMaximo: z.number().int().positive().optional(),
    precio:     z.number().positive().optional(),
    profesorId: z.number().int().positive().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Se debe proveer al menos un campo para editar",
  });

// motivoExcepcion es siempre requerido en este endpoint
export const editarInstanciaSchema = z.object({
  zona:            z.nativeEnum(ZonaClase).optional(),
  cupoMaximo:      z.number().int().positive().optional(),
  precio:          z.number().positive().optional(),
  profesorId:      z.number().int().positive().optional(),
  motivoExcepcion: z.string().min(1, "El motivo de la excepción es obligatorio"),
});

export const crearSueltaSchema = z.object({
  fecha:      z.string().datetime({ message: "Formato de fecha inválido (ISO 8601 requerido)" }),
  zona:       z.nativeEnum(ZonaClase, { errorMap: () => ({ message: "Zona inválida" }) }),
  cupoMaximo: z.number().int().positive("El cupo debe ser mayor a 0"),
  precio:     z.number().positive("El precio debe ser mayor a 0"),
  profesorId: z.number().int().positive("profesorId inválido"),
});
