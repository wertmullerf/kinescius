import { createContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '@/api/endpoints/auth'
import type { AuthUser } from '@/types'

export type LoginResult =
  | { type: 'success'; user: AuthUser }
  | { type: '2fa_required'; userId: number }

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<LoginResult>
  verify2FA: (userId: number, codigo: string) => Promise<AuthUser>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user:        null,
  token:       null,
  isLoading:   true,
  login:       async () => { throw new Error('AuthProvider no montado') },
  verify2FA:   async () => { throw new Error('AuthProvider no montado') },
  logout:      async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null)
  const [token,     setToken]     = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
        localStorage.removeItem('token')
        setToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const response = await authApi.login(email, password)
    if ('requires2FA' in response && response.requires2FA) {
      return { type: '2fa_required', userId: response.userId }
    }
    localStorage.setItem('token', response.token)
    setToken(response.token)
    const me = await authApi.me()
    setUser(me)
    return { type: 'success', user: me }
  }, [])

  const verify2FA = useCallback(async (userId: number, codigo: string): Promise<AuthUser> => {
    const response = await authApi.verify2FA(userId, codigo)
    localStorage.setItem('token', response.token)
    setToken(response.token)
    const me = await authApi.me()
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch { /* ignorar */ }
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    window.location.href = '/login'
  }, [])

  // Útil después de reservar/abonar para reflejar el nuevo clasesDisponibles
  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.me()
      setUser(me)
    } catch { /* silencioso */ }
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, verify2FA, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
