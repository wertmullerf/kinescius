import { get, post, put, del } from '@/api/client'
import type { Profesor } from '@/types'

export const profesoresApi = {
  listar: () => get<Profesor[]>('/profesores'),

  obtener: (id: number) => get<Profesor>(`/profesores/${id}`),

  crear: (data: { nombre: string; apellido: string; dni: string }) =>
    post<Profesor>('/profesores', data),

  editar: (id: number, data: Partial<{ nombre: string; apellido: string; dni: string }>) =>
    put<Profesor>(`/profesores/${id}`, data),

  eliminar: (id: number) => del<void>(`/profesores/${id}`),
}
