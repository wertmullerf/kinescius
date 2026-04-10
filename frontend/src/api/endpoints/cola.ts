import { get, post, del } from '@/api/client'
import type { ColaEspera } from '@/types'

export const colaApi = {
  unirse: (instanciaId: number) =>
    post<{ posicion: number }>(`/cola-espera/${instanciaId}`),

  salir: (instanciaId: number) =>
    del<void>(`/cola-espera/${instanciaId}`),

  listar: (instanciaId: number) =>
    get<ColaEspera[]>(`/cola-espera/${instanciaId}`),

  misEntradas: () =>
    get<ColaEspera[]>('/cola-espera/mias'),
}
