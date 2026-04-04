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

import type { ClaseRecurrente, ClaseInstancia } from "@prisma/client";

/** ClaseInstancia con su patrón recurrente incluido (join más común). */
export type ClaseInstanciaConRecurrente = ClaseInstancia & {
  recurrente: ClaseRecurrente;
};
