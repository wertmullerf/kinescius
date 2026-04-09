import { get, put, del } from '@/api/client'
import type { Usuario } from '@/types'

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
    return get<Usuario[]>(`/usuarios${query ? `?${query}` : ''}`)
  },

  obtener: (id: number) => get<Usuario>(`/usuarios/${id}`),

  editar: (id: number, data: {
    nombre: string
    apellido: string
    dni: string
    email: string
  }) => put<Usuario>(`/usuarios/${id}`, data),

  eliminar: (id: number) => del<void>(`/usuarios/${id}`),
}
