import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ProfesoresPage } from '@/pages/profesores/ProfesoresPage'
import { ClasesPage } from '@/pages/clases/ClasesPage'
import { ReservasPage } from '@/pages/reservas/ReservasPage'
import { ReservasAdminPage } from '@/pages/reservas/ReservasAdminPage'
import { AbonosPage } from '@/pages/abonos/AbonosPage'
import { ConfiguracionPage } from '@/pages/configuracion/ConfiguracionPage'
import { UsuariosPage } from '@/pages/usuarios/UsuariosPage'
import { PagosPage } from '@/pages/pagos/PagosPage'
import { AsistenciasPage } from '@/pages/asistencias/AsistenciasPage'
import type { Rol } from '@/types'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-text-secondary text-lg">{title} — próximamente</p>
    </div>
  )
}

function LoadingScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex items-center justify-center bg-surface"
    >
      <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
    </motion.div>
  )
}

interface PrivateRouteProps {
  children: React.ReactNode
  roles?: Rol[]
}

function ReservasRoute() {
  const { user } = useAuth()
  if (!user) return null
  return user.rol === 'ADMIN' ? <ReservasAdminPage /> : <ReservasPage />
}

function PrivateRoute({ children, roles }: PrivateRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.rol)) {
    const fallback = user.rol === 'PROFESOR' ? '/asistencias'
                   : user.rol === 'CLIENTE'  ? '/reservas'
                   : '/dashboard'
    return <Navigate to={fallback} replace />
  }

  return <>{children}</>
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard"
            element={<PrivateRoute roles={['ADMIN']}><DashboardPage /></PrivateRoute>}
          />
          <Route path="/clases"
            element={<PrivateRoute roles={['ADMIN', 'PROFESOR']}><ClasesPage /></PrivateRoute>}
          />
          <Route path="/reservas"
            element={<PrivateRoute roles={['ADMIN', 'CLIENTE']}><ReservasRoute /></PrivateRoute>}
          />
          <Route path="/abonos"
            element={<PrivateRoute roles={['CLIENTE']}><AbonosPage /></PrivateRoute>}
          />
          <Route path="/profesores"
            element={<PrivateRoute roles={['ADMIN']}><ProfesoresPage /></PrivateRoute>}
          />
          <Route path="/configuracion"
            element={<PrivateRoute roles={['ADMIN']}><ConfiguracionPage /></PrivateRoute>}
          />
          <Route path="/pagos"
            element={<PrivateRoute roles={['ADMIN']}><PagosPage /></PrivateRoute>}
          />
          <Route path="/usuarios"
            element={<PrivateRoute roles={['ADMIN']}><UsuariosPage /></PrivateRoute>}
          />
          <Route path="/asistencias"
            element={<PrivateRoute roles={['ADMIN', 'PROFESOR']}><AsistenciasPage /></PrivateRoute>}
          />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
