import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HomeIcon,
  CalendarDaysIcon,
  BookmarkIcon,
  CreditCardIcon,
  UsersIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
  XMarkIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import type { Rol } from '@/types'

interface NavItem {
  label: string
  href: string
  icon: typeof HomeIcon
  roles: Rol[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard',   href: '/dashboard',   icon: HomeIcon,                   roles: ['ADMIN'] },
  { label: 'Clases',      href: '/clases',      icon: CalendarDaysIcon,           roles: ['ADMIN', 'PROFESOR'] },
  { label: 'Reservas',    href: '/reservas',    icon: BookmarkIcon,               roles: ['ADMIN', 'CLIENTE'] },
  { label: 'Abonos',      href: '/abonos',      icon: CurrencyDollarIcon,         roles: ['CLIENTE'] },
  { label: 'Dar presente', href: '/dar-presente', icon: QrCodeIcon,               roles: ['CLIENTE'] },
  { label: 'Pagos',          href: '/pagos',          icon: CreditCardIcon,             roles: ['ADMIN'] },
  { label: 'Usuarios',       href: '/usuarios',       icon: UsersIcon,                  roles: ['ADMIN'] },
  { label: 'Profesores',     href: '/profesores',     icon: UserGroupIcon,              roles: ['ADMIN'] },
  { label: 'Asistencias',    href: '/asistencias',    icon: ClipboardDocumentCheckIcon, roles: ['ADMIN', 'PROFESOR'] },
  { label: 'Configuración',  href: '/configuracion',  icon: Cog6ToothIcon,              roles: ['ADMIN'] },
]

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { user } = useAuth()
  const visibleItems = navItems.filter(item => user && item.roles.includes(user.rol))

  const content = (
    <aside className="flex flex-col h-full bg-surface border-r border-surface-border w-64">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 h-16 border-b border-surface-border">
        <img src="/logo.png" alt="Kinesius" className="h-16" />
        {onMobileClose && (
          <button onClick={onMobileClose} className="lg:hidden p-1 text-text-secondary">
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(item => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={onMobileClose}
            className={({ isActive }) => [
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand-green/10 text-brand-green-dark'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted',
            ].join(' ')}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User info + clases restantes */}
      {user && (
        <div className="px-4 py-4 border-t border-surface-border">
          <p className="text-xs font-medium text-text-primary truncate">
            {user.nombre} {user.apellido}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">{user.rol}</p>

          {/* Badge de clases para abonados */}
          {user.tipoCliente === 'ABONADO' && (
            <div className="mt-2.5 flex items-center gap-2 bg-brand-green/10 rounded-lg px-2.5 py-1.5">
              <div className="w-2 h-2 rounded-full bg-brand-green flex-shrink-0" />
              <span className="text-xs font-semibold text-brand-green-dark">
                {user.clasesDisponibles ?? 0}{' '}
                {(user.clasesDisponibles ?? 0) === 1 ? 'clase' : 'clases'} disponibles
              </span>
            </div>
          )}

          {/* Badge de sanción */}
          {user.sancionado && (
            <div className="mt-1.5 flex items-center gap-2 bg-status-cancelada/10 rounded-lg px-2.5 py-1.5">
              <div className="w-2 h-2 rounded-full bg-status-cancelada flex-shrink-0" />
              <span className="text-xs font-semibold text-status-cancelada">
                Cuenta sancionada
              </span>
            </div>
          )}
        </div>
      )}
    </aside>
  )

  return (
    <>
      <div className="hidden lg:flex h-full">{content}</div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              onClick={onMobileClose}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              {content}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
