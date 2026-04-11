import { get, patch, post } from '@/api/client'
import type { Asistencia, ClaseInstancia, Reserva, ZonaClase } from '@/types'

interface ClaseConAsistencias extends ClaseInstancia {
  reservas: (Reserva & { asistencia?: Asistencia })[]
}

export interface AlumnoReserva {
  id: number          // reservaId
  estado: string
  cliente: { id: number; nombre: string; apellido: string; tipoCliente: string }
  asistencia?: { id: number; presente: boolean } | null
}

export interface ClaseProfesor extends ClaseInstancia {
  reservas: AlumnoReserva[]
}

export interface AsistenciaAdmin {
  id: number
  presente: boolean
  registradoPor?: number
  reservaId: number
  createdAt: string
  reserva: {
    id: number
    estado: string
    cliente: { id: number; nombre: string; apellido: string; email: string }
    instancia: {
      fecha: string
      zona: ZonaClase
      profesor: { nombre: string; apellido: string }
    }
  }
}

export interface HistorialClienteResponse {
  cliente: { id: number; nombre: string; apellido: string }
  reservas: Array<{
    id: number
    estado: string
    instancia: { id: number; fecha: string; zona: ZonaClase }
    asistencia?: { presente: boolean }
  }>
}

export const asistenciasApi = {
  // Profesor escanea QR y carga la clase con la lista de alumnos
  porQr: (codigoQr: string) =>
    get<ClaseConAsistencias>(`/asistencias/qr/${codigoQr}`),

  // Registrar/actualizar asistencia de un alumno
  registrar: (reservaId: number, presente: boolean) =>
    patch<Asistencia>(`/asistencias/${reservaId}`, { presente }),

  // Admin: vista completa de asistencia de una clase
  porClase: (instanciaId: number) =>
    get<ClaseConAsistencias>(`/asistencias/clase/${instanciaId}`),

  // Admin: historial de asistencias de un cliente
  historialCliente: (clienteId: number) =>
    get<HistorialClienteResponse>(`/asistencias/cliente/${clienteId}`),

  // Profesor: sus clases (últimos 2 días + próximos 60) con lista de alumnos
  misClases: () =>
    get<ClaseProfesor[]>('/asistencias/mis-clases'),

  // Cliente escanea QR y se marca presente
  darPresente: (codigoQr: string) =>
    post<Asistencia>('/asistencias/dar-presente', { codigoQr }),

  // Admin: listado global con filtro opcional
  listarTodas: (q?: string) => {
    const query = q ? `?q=${encodeURIComponent(q)}` : ''
    return get<AsistenciaAdmin[]>(`/asistencias${query}`)
  },
}
