import { Bars3Icon, ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth()

  return (
    <header className="h-16 bg-surface border-b border-surface-border flex items-center justify-between px-4 lg:px-6">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-text-secondary hover:bg-surface-muted transition-colors"
      >
        <Bars3Icon className="w-5 h-5" />
      </button>

      <div className="flex-1 lg:flex-none" />

      <div className="flex items-center gap-3">
        {user && (
          <span className="hidden sm:block text-sm text-text-secondary">
            {user.nombre} {user.apellido}
          </span>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-muted rounded-lg transition-colors"
        >
          <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
