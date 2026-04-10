import { get, post } from '@/api/client'
import type { Pago, PagoAbono, MetodoPago, ZonaClase, EstadoReserva } from '@/types'

export interface PagoAbonoConCliente extends PagoAbono {
  cliente: { id: number; nombre: string; apellido: string; email: string }
}

export interface PagoConReserva extends Pago {
  reserva: {
    id: number
    estado: EstadoReserva
    cliente: { id: number; nombre: string; apellido: string; email: string }
    instancia: { fecha: string; zona: ZonaClase }
  }
}

interface AbonoMpResponse {
  initPoint: string
  external_reference: string
  montoFinal: number
  mpPrefId: string
}

export const pagosApi = {
  // Admin: registrar abono presencial
  registrarAbono: (data: {
    clienteId: number
    cantidadClases: number
    precioPorClase: number
    metodo: MetodoPago
    referencia?: string
  }) => post<PagoAbono>('/pagos/abono', data),

  // Cliente: iniciar abono vía Mercado Pago
  iniciarAbonoMp: (data: {
    cantidadClases: number
    precioPorClase: number
  }) => post<AbonoMpResponse>('/pagos/abono/mp', data),

  // Admin: registrar complemento de pago
  registrarComplemento: (reservaId: number, data: {
    metodo: MetodoPago
    referencia?: string
  }) => post<Pago>(`/pagos/complemento/${reservaId}`, data),

  // Admin: historial de abonos de un cliente
  historialAbonos: (clienteId: number) =>
    get<PagoAbono[]>(`/pagos/abonos/${clienteId}`),

  // Admin / Cliente: pagos de una reserva
  pagosPorReserva: (reservaId: number) =>
    get<Pago[]>(`/pagos/reserva/${reservaId}`),

  // Admin: todos los abonos, con filtro opcional
  listarAbonos: (q?: string) => {
    const query = q ? `?q=${encodeURIComponent(q)}` : ''
    return get<PagoAbonoConCliente[]>(`/pagos/abonos${query}`)
  },

  // Admin: todos los pagos de reservas, con filtro opcional
  listarHistorial: (q?: string) => {
    const query = q ? `?q=${encodeURIComponent(q)}` : ''
    return get<PagoConReserva[]>(`/pagos/historial${query}`)
  },
}
