import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { staggerContainer, staggerItem } from '@/utils/animations'

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">
          Bienvenido, {user?.nombre}
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Panel de administración de Kinesius
        </p>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {[
          { label: 'Clases activas',    value: '—', color: 'bg-brand-green/10 text-brand-green-dark' },
          { label: 'Reservas hoy',      value: '—', color: 'bg-status-paga/10 text-status-paga' },
          { label: 'Usuarios totales',  value: '—', color: 'bg-status-pendiente/10 text-status-pendiente' },
        ].map(card => (
          <motion.div
            key={card.label}
            variants={staggerItem}
            className="bg-surface rounded-xl p-6 shadow-card border border-surface-border"
          >
            <p className="text-sm text-text-secondary mb-2">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
