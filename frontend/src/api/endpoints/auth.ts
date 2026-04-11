import { post, get } from '@/api/client'
import type { LoginResponse, AuthUser } from '@/types'

export const authApi = {
  login: (email: string, password: string) =>
    post<LoginResponse>('/auth/login', { email, password }),

  register: (data: {
    nombre: string
    apellido: string
    dni: string
    email: string
    password: string
  }) => post<LoginResponse>('/auth/register', data),

  logout: () => post<void>('/auth/logout'),

  me: () => get<AuthUser>('/auth/me'),

  forgotPassword: (email: string) =>
    post<void>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    post<void>('/auth/reset-password', { token, password }),
}
