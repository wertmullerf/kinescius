import type { EstadoReserva, ZonaClase, MetodoPago, TipoPago } from '@/types'

export const formatDate = (iso: string): string => {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export const formatTime = (iso: string): string => {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount)
}

export const estadoLabel: Record<EstadoReserva, string> = {
  PENDIENTE_PAGO: 'Pendiente de pago',
  RESERVA_PAGA:   'Seña pagada',
  CONFIRMADA:     'Confirmada',
  CANCELADA:      'Cancelada',
  COMPLETADA:     'Completada',
}

export const zonaLabel: Record<ZonaClase, string> = {
  ALTA:  'Alta',
  MEDIA: 'Media',
  BAJA:  'Baja',
}

export const metodoPagoLabel: Record<MetodoPago, string> = {
  EFECTIVO:      'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  MERCADO_PAGO:  'Mercado Pago',
  TARJETA:       'Tarjeta',
}

export const tipoPagoLabel: Record<TipoPago, string> = {
  SENA:        'Seña',
  COMPLEMENTO: 'Complemento',
  ABONO:       'Abono',
}

// ── Helpers para el Dashboard ─────────────────────────────────────────────────

/** Formatea un monto como pesos argentinos, sin decimales. */
export const formatARS = (monto: number): string =>
  new Intl.NumberFormat('es-AR', {
    style:                 'currency',
    currency:              'ARS',
    maximumFractionDigits: 0,
  }).format(monto)

/**
 * Devuelve una cadena de tiempo relativo en español.
 * - < 60 min  → "hace X minutos"
 * - < 24 hs   → "hace X horas"
 * - < 48 hs   → "ayer"
 * - resto     → fecha en formato dd/mm/yyyy
 */
export const timeAgo = (fecha: string): string => {
  const diff = Date.now() - new Date(fecha).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)

  if (mins < 1)    return 'justo ahora'
  if (mins < 60)   return `hace ${mins} ${mins === 1 ? 'minuto' : 'minutos'}`
  if (hours < 24)  return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  if (hours < 48)  return 'ayer'

  return new Date(fecha).toLocaleDateString('es-AR', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  })
}

/**
 * Calcula la variación porcentual entre dos valores.
 * Devuelve null si el valor anterior es 0 (división por cero).
 */
export const calcVariacion = (actual: number, anterior: number): number | null => {
  if (anterior === 0) return null
  return Number(((actual - anterior) / anterior * 100).toFixed(1))
}
