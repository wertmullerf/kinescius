import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import type { Rol } from '@/types'

// Páginas placeholder para rutas aún no implementadas
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-text-secondary text-lg">{title} — próximamente</p>
    </div>
  )
}

// Spinner mientras se carga la sesión
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

function PrivateRoute({ children, roles }: PrivateRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.rol)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Privadas */}
        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute roles={['ADMIN']}>
                <DashboardPage />
              </PrivateRoute>
            }
          />

          <Route path="/clases"      element={<PlaceholderPage title="Clases" />} />
          <Route path="/reservas"    element={<PlaceholderPage title="Reservas" />} />
          <Route path="/pagos"       element={<PlaceholderPage title="Pagos" />} />
          <Route path="/usuarios"    element={<PlaceholderPage title="Usuarios" />} />
          <Route path="/profesores"  element={<PlaceholderPage title="Profesores" />} />
          <Route path="/asistencias" element={<PlaceholderPage title="Asistencias" />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
