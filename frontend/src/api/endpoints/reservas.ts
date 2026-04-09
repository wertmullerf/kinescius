import { get, post, del, patch } from '@/api/client'
import type { Reserva } from '@/types'

export const reservasApi = {
  listar: () => get<Reserva[]>('/reservas'),

  obtener: (id: number) => get<Reserva>(`/reservas/${id}`),

  crear: (instanciaId: number) => post<Reserva | { posicionCola: number }>('/reservas', { instanciaId }),

  cambiar: (id: number, nuevaInstanciaId: number) =>
    patch<Reserva>(`/reservas/${id}/cambiar`, { nuevaInstanciaId }),

  cancelar: (id: number) => del<void>(`/reservas/${id}`),
}
