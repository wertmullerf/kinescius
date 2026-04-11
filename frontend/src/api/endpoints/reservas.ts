import { get, post, del, patch } from '@/api/client'
import type { Reserva, CrearReservaResult } from '@/types'

export const reservasApi = {
  listar: (params?: { instanciaId?: number; clienteId?: number }) => {
    const q = new URLSearchParams()
    if (params?.instanciaId) q.set('instanciaId', String(params.instanciaId))
    if (params?.clienteId)   q.set('clienteId',   String(params.clienteId))
    const qs = q.toString() ? `?${q.toString()}` : ''
    return get<Reserva[]>(`/reservas${qs}`)
  },

  obtener: (id: number) => get<Reserva>(`/reservas/${id}`),

  crear: (instanciaId: number) =>
    post<CrearReservaResult>('/reservas', { instanciaId }),

  cambiar: (id: number, nuevaInstanciaId: number) =>
    patch<Reserva>(`/reservas/${id}/cambiar`, { nuevaInstanciaId }),

  cancelar: (id: number) => del<void>(`/reservas/${id}`),

  obtenerInitPoint: (id: number) =>
    get<{ initPoint: string }>(`/reservas/${id}/init-point`),
}
