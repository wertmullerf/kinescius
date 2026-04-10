import { get, patch } from '@/api/client'

export interface AppConfig {
  minutosClase: string
  precioClase:  string
}

export const configApi = {
  obtener: () => get<AppConfig>('/config'),

  actualizar: (cambios: Partial<AppConfig>) =>
    patch<AppConfig>('/config', cambios),
}
