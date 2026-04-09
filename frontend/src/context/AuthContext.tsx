import { createContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '@/api/endpoints/auth'
import type { AuthUser } from '@/types'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user:      null,
  token:     null,
  isLoading: true,
  login:     async () => {},
  logout:    async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null)
  const [token,     setToken]     = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Al montar: rehidratar sesión desde localStorage sin pedir login
  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    if (!savedToken) {
      setIsLoading(false)
      return
    }

    setToken(savedToken)
    authApi.me()
      .then(me => setUser(me))
      .catch(() => {
        // Token inválido o expirado
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password)
    localStorage.setItem('token', response.token)
    setToken(response.token)
    setUser(response.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignorar error de logout — limpiar igual
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setToken(null)
      setUser(null)
      window.location.href = '/login'
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
