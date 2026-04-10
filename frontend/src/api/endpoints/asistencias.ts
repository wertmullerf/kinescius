import { get, patch } from '@/api/client'
import type { Asistencia, ClaseInstancia, Reserva, ZonaClase } from '@/types'

interface ClaseConAsistencias extends ClaseInstancia {
  reservas: (Reserva & { asistencia?: Asistencia })[]
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

  // Admin: listado global con filtro opcional
  listarTodas: (q?: string) => {
    const query = q ? `?q=${encodeURIComponent(q)}` : ''
    return get<AsistenciaAdmin[]>(`/asistencias${query}`)
  },
}
