import { get, put, del } from '@/api/client'
import type { Usuario, EstadoReserva, ZonaClase } from '@/types'

export interface UsuarioAdmin extends Omit<Usuario, 'rol'> {
  rol: 'ADMIN' | 'PROFESOR' | 'CLIENTE'
  reservas?: Array<{
    id: number
    estado: EstadoReserva
    montoPagado: number
    createdAt: string
    instancia?: { id: number; fecha: string; zona: ZonaClase }
  }>
}

export const usuariosApi = {
  listar: (params?: {
    busqueda?: string
    tipoCliente?: 'ABONADO' | 'NO_ABONADO'
    sancionado?: boolean
  }) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params ?? {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    ).toString()
    return get<UsuarioAdmin[]>(`/usuarios${query ? `?${query}` : ''}`)
  },

  obtener: (id: number) => get<UsuarioAdmin>(`/usuarios/${id}`),

  editar: (id: number, data: Partial<Pick<UsuarioAdmin, 'nombre' | 'apellido' | 'dni' | 'email' | 'sancionado'>>) =>
    put<UsuarioAdmin>(`/usuarios/${id}`, data),

  eliminar: (id: number) => del<void>(`/usuarios/${id}`),
}
