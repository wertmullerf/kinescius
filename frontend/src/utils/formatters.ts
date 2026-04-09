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
  EFECTIVO:     'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  MERCADO_PAGO: 'Mercado Pago',
}

export const tipoPagoLabel: Record<TipoPago, string> = {
  SENA:        'Seña',
  COMPLEMENTO: 'Complemento',
  ABONO:       'Abono',
}
