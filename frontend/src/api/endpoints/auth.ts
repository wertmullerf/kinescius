import { post, get } from '@/api/client'
import type { LoginResponse, TwoFARequired, AuthUser } from '@/types'

export const authApi = {
  login: (email: string, password: string) =>
    post<LoginResponse | TwoFARequired>('/auth/login', { email, password }),

  verify2FA: (userId: number, codigo: string) =>
    post<LoginResponse>('/auth/verify-2fa', { userId, codigo }),

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
