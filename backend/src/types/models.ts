// Tipos de dominio — re-exportados desde @prisma/client para uso centralizado.
// Importar siempre desde acá, no directamente desde @prisma/client, para que
// un eventual cambio de ORM solo requiera tocar este archivo.

export type {
  Usuario,
  Profesor,
  AgendaMensual,
  ClaseRecurrente,
  ClaseInstancia,
  Reserva,
  Pago,
  PagoLog,
  Asistencia,
  ColaEspera,
} from "@prisma/client";

export {
  Rol,
  TipoCliente,
  ZonaClase,
  EstadoReserva,
  MetodoPago,
  TipoPago,
} from "@prisma/client";

// ─────────────────────────────────────────
// Tipos de utilidad para payloads frecuentes
// ─────────────────────────────────────────

import type { Prisma, ClaseRecurrente, ClaseInstancia } from "@prisma/client";

/** ClaseInstancia con su patrón recurrente incluido (join más común). */
export type ClaseInstanciaConRecurrente = ClaseInstancia & {
  recurrente: ClaseRecurrente;
};

/**
 * ClaseRecurrente enriquecida para listados.
 * hora es un ISO DateTime donde solo importa HH:mm.
 */
export type ClaseRecurrenteConDetalle = Prisma.ClaseRecurrenteGetPayload<{
  include: {
    profesor: { select: { id: true; nombre: true; apellido: true } };
    _count: { select: { instancias: true } };
  };
}>;

/**
 * ClaseInstancia enriquecida para listados.
 * Incluye datos del profesor y conteo de reservas vs cupoMaximo.
 */
export type ClaseInstanciaConDetalle = Prisma.ClaseInstanciaGetPayload<{
  include: {
    profesor: { select: { id: true; nombre: true; apellido: true } };
    _count: { select: { reservas: true } };
  };
}>;

/** AgendaMensual con conteo de patrones recurrentes. */
export type AgendaMensualConConteo = Prisma.AgendaMensualGetPayload<{
  include: { _count: { select: { clases: true } } };
}>;
