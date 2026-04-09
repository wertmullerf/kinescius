import { get, post, put, patch, del } from '@/api/client'
import type { ClaseInstancia } from '@/types'

interface AgendaMensual {
  id: number
  mes: number
  anio: number
}

interface ClaseRecurrente {
  id: number
  diaSemana: number
  hora: string
  zona: string
  cupoMaximo: number
  duracion: number
  precio: number
  profesorId: number
}

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

  crearRecurrente: (agendaId: number, data: Omit<ClaseRecurrente, 'id'>) =>
    post<ClaseRecurrente>(`/agenda/${agendaId}/recurrentes`, data),

  editarRecurrente: (agendaId: number, id: number, data: Partial<Omit<ClaseRecurrente, 'id'>>) =>
    put<ClaseRecurrente>(`/agenda/${agendaId}/recurrentes/${id}`, data),

  eliminarRecurrente: (agendaId: number, id: number) =>
    del<void>(`/agenda/${agendaId}/recurrentes/${id}`),

  // Instancias
  listarInstancias: (agendaId: number, params?: { zona?: string; fecha?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return get<ClaseInstancia[]>(`/agenda/${agendaId}/instancias${query ? `?${query}` : ''}`)
  },

  crearSuelta: (data: {
    fecha: string
    zona: string
    cupoMaximo: number
    duracion: number
    precio: number
    profesorId: number
  }) => post<ClaseInstancia>('/instancias/sueltas', data),

  eliminarSuelta: (id: number) => del<void>(`/instancias/sueltas/${id}`),

  editarInstancia: (id: number, data: Partial<{
    profesorId: number
    cupoMaximo: number
    precio: number
    esExcepcion: boolean
    motivoExcepcion: string
  }>) => patch<ClaseInstancia>(`/instancias/${id}`, data),

  cancelarInstancia: (id: number) => patch<void>(`/instancias/${id}/cancelar`),
}
