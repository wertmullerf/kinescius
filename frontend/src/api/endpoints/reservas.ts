import { get, post, del, patch } from '@/api/client'
import type { Reserva, CrearReservaResult } from '@/types'

export const reservasApi = {
  listar: (params?: { instanciaId?: number }) => {
    const query = params?.instanciaId ? `?instanciaId=${params.instanciaId}` : ''
    return get<Reserva[]>(`/reservas${query}`)
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
