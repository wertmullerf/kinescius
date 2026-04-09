import type { EstadoReserva } from '@/types'
import { COLORS } from '@/constants/colors'

interface BadgeProps {
  label: string
  estado?: EstadoReserva
  color?: string
}

const estadoColorMap: Record<EstadoReserva, string> = {
  PENDIENTE_PAGO: COLORS.status.PENDIENTE_PAGO,
  RESERVA_PAGA:   COLORS.status.RESERVA_PAGA,
  CONFIRMADA:     COLORS.status.CONFIRMADA,
  CANCELADA:      COLORS.status.CANCELADA,
  COMPLETADA:     COLORS.status.COMPLETADA,
}

export function Badge({ label, estado, color }: BadgeProps) {
  const bg = estado ? estadoColorMap[estado] : (color ?? '#e5e7eb')

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${bg}20`,
        color: bg,
        border: `1px solid ${bg}40`,
      }}
    >
      {label}
    </span>
  )
}
