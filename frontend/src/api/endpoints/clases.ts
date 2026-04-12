import { get, post, put, patch, del } from '@/api/client'
import type { ClaseInstancia, AgendaMensual, ClaseRecurrente, ZonaClase } from '@/types'

export const clasesApi = {
  // Agenda
  listarAgendas: () => get<AgendaMensual[]>('/agenda'),

  obtenerAgenda: (id: number) => get<AgendaMensual>(`/agenda/${id}`),

  crearAgenda: (mes: number, anio: number) =>
    post<AgendaMensual>('/agenda', { mes, anio }),

  eliminarAgenda: (id: number) => del<void>(`/agenda/${id}`),

  // Patrones recurrentes
  listarRecurrentes: (agendaId: number) =>
    get<ClaseRecurrente[]>(`/agenda/${agendaId}/recurrentes`),

  crearRecurrente: (agendaId: number, data: Omit<ClaseRecurrente, 'id' | 'profesor'>) =>
    post<ClaseRecurrente>(`/agenda/${agendaId}/recurrentes`, data),

  editarRecurrente: (agendaId: number, id: number, data: Partial<Omit<ClaseRecurrente, 'id' | 'profesor'>>) =>
    put<ClaseRecurrente>(`/agenda/${agendaId}/recurrentes/${id}`, data),

  eliminarRecurrente: (agendaId: number, id: number) =>
    del<void>(`/agenda/${agendaId}/recurrentes/${id}`),

  // Instancias
  listarInstancias: (agendaId: number, params?: { zona?: ZonaClase; fecha?: string }) => {
    const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined)
    const query = new URLSearchParams(entries as [string, string][]).toString()
    return get<ClaseInstancia[]>(`/agenda/${agendaId}/instancias${query ? `?${query}` : ''}`)
  },

  crearSuelta: (data: {
    fecha: string
    zona: ZonaClase
    cupoMaximo: number
    profesorId: number
  }) => post<ClaseInstancia>('/instancias/sueltas', data),

  eliminarSuelta: (id: number) => del<void>(`/instancias/sueltas/${id}`),

  editarInstancia: (id: number, data: {
    fecha?: string
    zona?: ZonaClase
    profesorId?: number
    motivoExcepcion: string
  }) => patch<ClaseInstancia>(`/instancias/${id}`, data),

  cancelarInstancia: (id: number) => patch<void>(`/instancias/${id}/cancelar`),
}
