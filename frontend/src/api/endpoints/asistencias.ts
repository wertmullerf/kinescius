import { get, patch } from '@/api/client'
import type { Asistencia, ClaseInstancia, Reserva } from '@/types'

interface ClaseConAsistencias extends ClaseInstancia {
  reservas: (Reserva & { asistencia?: Asistencia })[]
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
  porCliente: (clienteId: number) =>
    get<Reserva[]>(`/asistencias/cliente/${clienteId}`),
}
