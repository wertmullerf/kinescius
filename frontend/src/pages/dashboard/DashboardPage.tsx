import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  UsersIcon,
  BanknotesIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserGroupIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { getDashboardStats } from '@/api/endpoints/reportes'
import type { DashboardStats, ZonaClase } from '@/types'
import { staggerContainer, staggerItem, fadeInUp } from '@/utils/animations'
import { formatARS, timeAgo, calcVariacion } from '@/utils/formatters'

// ── Zona helpers ──────────────────────────────────────────────────────────────

const zonaBadgeClass: Record<ZonaClase, string> = {
  ALTA:  'bg-brand-green-dark/10 text-brand-green-dark',
  MEDIA: 'bg-brand-green/15 text-brand-green',
  BAJA:  'bg-yellow-50 text-yellow-700',
}

const zonaBarClass: Record<ZonaClase, string> = {
  ALTA:  'bg-brand-green-dark',
  MEDIA: 'bg-brand-green',
  BAJA:  'bg-brand-yellow',
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-border rounded ${className ?? ''}`} />
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-xl p-6 shadow-card border border-surface-border space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Chart skeleton */}
          <div className="bg-surface rounded-xl p-6 shadow-card border border-surface-border">
            <Skeleton className="h-4 w-48 mb-1" />
            <Skeleton className="h-3 w-36 mb-6" />
            <div className="flex items-end gap-2 h-32">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <Skeleton className="w-full" style={{ height: `${30 + Math.random() * 60}%` }} />
                  <Skeleton className="h-2 w-6" />
                </div>
              ))}
            </div>
          </div>
          {/* Table skeleton */}
          <div className="bg-surface rounded-xl p-6 shadow-card border border-surface-border">
            <Skeleton className="h-4 w-32 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Zone skeleton */}
          <div className="bg-surface rounded-xl p-6 shadow-card border border-surface-border space-y-4">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            ))}
          </div>
          {/* Quick stats skeleton */}
          <div className="bg-surface rounded-xl p-6 shadow-card border border-surface-border space-y-4">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>

      {/* Activity skeleton */}
      <div className="bg-surface rounded-xl p-6 shadow-card border border-surface-border">
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <XCircleIcon className="w-12 h-12 text-status-cancelada" />
      <p className="text-text-secondary text-center">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-brand-green-dark text-white rounded-lg text-sm font-medium hover:bg-brand-green-dark/90 transition-colors"
      >
        Reintentar
      </button>
    </div>
  )
}

// ── Card metrics ──────────────────────────────────────────────────────────────

interface StatCardProps {
  icon:     React.ReactNode
  label:    string
  value:    string | number
  sub?:     React.ReactNode
  accent?:  'yellow' | 'red'
  tooltip?: string
}

function StatCard({ icon, label, value, sub, accent, tooltip }: StatCardProps) {
  const accentClass = accent === 'yellow'
    ? 'border-l-4 border-brand-yellow'
    : accent === 'red'
      ? 'border-l-4 border-red-400'
      : ''

  return (
    <motion.div
      variants={staggerItem}
      className={`bg-surface rounded-xl p-5 shadow-card border border-surface-border ${accentClass}`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-text-secondary font-medium">{label}</p>
        <div className="p-2 bg-surface-muted rounded-lg text-text-secondary">{icon}</div>
      </div>
      <p className="text-3xl font-bold text-text-primary mb-1">{value}</p>
      {sub && <div className="text-sm text-text-secondary">{sub}</div>}
      {tooltip && <p className="text-xs text-text-secondary mt-1 leading-snug">{tooltip}</p>}
    </motion.div>
  )
}

// ── Bar chart (sin librería) ──────────────────────────────────────────────────

const CHART_HEIGHT = 120

function BarChart({ data }: { data: { dia: string; reservas: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.reservas), 1)

  return (
    <div className="bg-surface rounded-xl p-6 shadow-card border border-surface-border">
      <h3 className="text-sm font-semibold text-text-primary">Reservas por día de semana</h3>
      <p className="text-xs text-text-secondary mb-6">Promedio del mes actual</p>

      <div className="flex items-end gap-2" style={{ height: CHART_HEIGHT + 32 }}>
        {data.map((d, i) => {
          const barH = maxVal > 0 ? Math.max(4, (d.reservas / maxVal) * CHART_HEIGHT) : 4
          const isMax = d.reservas === maxVal && d.reservas > 0

          return (
            <div key={d.dia} className="flex flex-col items-center gap-1 flex-1">
              {/* valor encima de la barra */}
              <span className="text-xs font-bold text-text-primary h-4 leading-4">
                {d.reservas > 0 ? d.reservas : ''}
              </span>

              {/* contenedor con altura fija para que las barras se alineen abajo */}
              <div className="flex items-end w-full" style={{ height: CHART_HEIGHT }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: barH }}
                  transition={{ duration: 0.6, delay: i * 0.07, ease: 'easeOut' }}
                  className={`w-full rounded-t transition-colors cursor-default ${
                    isMax
                      ? 'bg-brand-green-dark'
                      : 'bg-brand-green-dark/20 hover:bg-brand-green'
                  }`}
                />
              </div>

              {/* label del día */}
              <span className="text-[10px] uppercase text-text-secondary tracking-wide">
                {d.dia.slice(0, 3)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Tabla clases de hoy ───────────────────────────────────────────────────────

function ClasesHoy({ clases }: { clases: DashboardStats['clasesHoy'] }) {
  if (clases.length === 0) {
    return (
      <div className="bg-surface rounded-xl p-6 shadow-card border border-surface-border">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Clases de Hoy</h3>
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-text-secondary">
          <CalendarIcon className="w-10 h-10 opacity-30" />
          <p className="text-sm">No hay clases programadas para hoy</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl shadow-card border border-surface-border overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-border">
        <h3 className="text-sm font-semibold text-text-primary">Clases de Hoy</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-muted text-text-secondary text-xs uppercase tracking-wide">
              <th className="px-4 py-2 text-left font-medium">Horario</th>
              <th className="px-4 py-2 text-left font-medium">Zona</th>
              <th className="px-4 py-2 text-left font-medium">Profesor</th>
              <th className="px-4 py-2 text-center font-medium">Cupos</th>
              <th className="px-4 py-2 text-center font-medium">Cola</th>
              <th className="px-4 py-2 text-center font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {clases.map((c) => {
              const pct = c.reservasActivas / c.cupoMaximo
              const estadoBadge =
                c.reservasActivas >= c.cupoMaximo
                  ? { label: 'Completo',       cls: 'bg-red-50 text-red-600' }
                  : pct >= 0.8
                    ? { label: 'Últimos lugares', cls: 'bg-yellow-50 text-yellow-700' }
                    : { label: 'Disponible',      cls: 'bg-green-50 text-brand-green-dark' }

              return (
                <tr key={c.id} className="hover:bg-surface-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary">{c.hora}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${zonaBadgeClass[c.zona]}`}>
                      {c.zona}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{c.profesor}</td>
                  <td className="px-4 py-3 text-center text-text-secondary">
                    {c.reservasActivas}/{c.cupoMaximo}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.enCola > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-yellow/20 text-yellow-700">
                        {c.enCola} en cola
                      </span>
                    ) : (
                      <span className="text-text-secondary">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge.cls}`}>
                      {estadoBadge.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Popularidad por zona ──────────────────────────────────────────────────────

function ZonaPopularidad({ data }: { data: DashboardStats['popularidadPorZona'] }) {
  return (
    <div className="bg-surface rounded-xl p-6 shadow-card border border-surface-border">
      <h3 className="text-sm font-semibold text-text-primary">Clases por Zona</h3>
      <p className="text-xs text-text-secondary mb-5">Mes actual</p>

      <div className="space-y-4">
        {data.map((z, i) => (
          <div key={z.zona}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-text-primary">{z.zona}</span>
              <span className="text-xs text-text-secondary">
                {z.reservas} reservas · {z.porcentaje}%
              </span>
            </div>
            {/* Barra de progreso horizontal con animación Framer Motion */}
            <div className="h-2 bg-surface-border rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${z.porcentaje}%` }}
                transition={{ duration: 0.7, delay: i * 0.1, ease: 'easeOut' }}
                className={`h-full rounded-full ${zonaBarClass[z.zona as ZonaClase]}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Estadísticas rápidas ──────────────────────────────────────────────────────

function QuickStats({ stats }: { stats: DashboardStats }) {
  const rows = [
    {
      icon:  <CheckCircleIcon className="w-5 h-5 text-brand-green-dark" />,
      label: 'Clases con cupo completo',
      value: stats.clasesConCupoCompleto,
      alert: false,
    },
    {
      icon:  <XCircleIcon className="w-5 h-5 text-status-cancelada" />,
      label: 'Tasa de cancelación',
      value: `${stats.tasaCancelacion}%`,
      alert: stats.tasaCancelacion > 20,
    },
    {
      icon:  <UserGroupIcon className="w-5 h-5 text-text-secondary" />,
      label: 'Clientes sancionados',
      value: stats.clientesSancionados,
      alert: false,
    },
  ]

  return (
    <div className="bg-surface rounded-xl p-6 shadow-card border border-surface-border">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Este Mes</h3>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <div className="p-1.5 bg-surface-muted rounded-lg flex-shrink-0">{row.icon}</div>
            <span className="text-sm text-text-secondary flex-1">{row.label}</span>
            <span
              className={`text-sm font-semibold ${
                row.alert ? 'text-status-cancelada' : 'text-text-primary'
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Feed de actividad reciente ────────────────────────────────────────────────

const actividadConfig = {
  RESERVA:    { icon: CalendarDaysIcon, bg: 'bg-blue-50',   color: 'text-blue-500'         },
  PAGO:       { icon: BanknotesIcon,    bg: 'bg-green-50',  color: 'text-brand-green'      },
  CANCELACION:{ icon: XCircleIcon,      bg: 'bg-red-50',    color: 'text-red-500'          },
  ABONO:      { icon: CreditCardIcon,   bg: 'bg-purple-50', color: 'text-purple-500'       },
} as const

function ActividadFeed({ items }: { items: DashboardStats['actividadReciente'] }) {
  return (
    <div className="bg-surface rounded-xl p-6 shadow-card border border-surface-border">
      <h3 className="text-sm font-semibold text-text-primary mb-5">Actividad Reciente</h3>

      {items.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-4">Sin actividad reciente</p>
      ) : (
        <motion.ul
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-4"
        >
          {items.map((item, i) => {
            const cfg  = actividadConfig[item.tipo]
            const Icon = cfg.icon

            return (
              <motion.li key={i} variants={staggerItem} className="flex items-start gap-3">
                {/* ícono con fondo coloreado según tipo */}
                <div className={`p-2 rounded-lg flex-shrink-0 ${cfg.bg}`}>
                  <Icon className={`w-5 h-5 ${cfg.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary leading-snug">
                    {item.descripcion}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {item.cliente} · {timeAgo(item.fecha)}
                  </p>
                </div>

                {/* monto solo para PAGO y ABONO */}
                {item.monto !== undefined && (
                  <span className="text-sm font-semibold text-brand-green-dark flex-shrink-0">
                    {formatARS(item.monto)}
                  </span>
                )}
              </motion.li>
            )
          })}
        </motion.ul>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats]     = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getDashboardStats()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  if (loading) return <DashboardSkeleton />
  if (error)   return <ErrorState message={error} onRetry={fetchStats} />
  if (!stats)  return null

  // Variación de ingresos mes a mes
  const varIngreso = calcVariacion(stats.ingresosMesActual, stats.ingresosMesAnterior)

  return (
    <motion.div {...fadeInUp} className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">
          Bienvenido, {user?.nombre}
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Panel de administración de Kinescius
        </p>
      </div>

      {/* FILA 1 — 4 cards ─────────────────────────────────────────────────── */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Card 1: Clientes */}
        <StatCard
          icon={<UsersIcon className="w-5 h-5" />}
          label="Clientes Activos"
          value={stats.clientesActivos}
          sub={
            <span className="flex items-center gap-1.5 flex-wrap">
              <span>{stats.clientesAbonados} abonados</span>
              {stats.clientesSancionados > 0 && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-medium">
                  {stats.clientesSancionados} sancionados
                </span>
              )}
            </span>
          }
        />

        {/* Card 2: Ingresos */}
        <StatCard
          icon={<BanknotesIcon className="w-5 h-5" />}
          label="Ingresos del Mes"
          value={formatARS(stats.ingresosMesActual)}
          sub={
            varIngreso !== null ? (
              <span
                className={`flex items-center gap-1 font-medium ${
                  varIngreso >= 0 ? 'text-brand-green-dark' : 'text-status-cancelada'
                }`}
              >
                {varIngreso >= 0 ? (
                  <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
                ) : (
                  <ArrowTrendingDownIcon className="w-3.5 h-3.5" />
                )}
                {varIngreso >= 0 ? '+' : ''}{varIngreso}% vs mes anterior
              </span>
            ) : undefined
          }
        />

        {/* Card 3: Cobros pendientes */}
        <StatCard
          icon={<ClockIcon className="w-5 h-5" />}
          label="Cobros Pendientes"
          value={stats.complementosPendientes}
          sub="reservas sin complemento"
          accent={stats.complementosPendientes > 0 ? 'yellow' : undefined}
          tooltip="Clientes que pagaron la seña, deben el resto presencialmente"
        />

        {/* Card 4: Reservas sin pagar */}
        <StatCard
          icon={<ExclamationCircleIcon className="w-5 h-5" />}
          label="Reservas Sin Pagar"
          value={stats.reservasPendientesPago}
          sub="pendientes de seña"
          accent={stats.reservasPendientesPago > 0 ? 'red' : undefined}
          tooltip="No abonados que reservaron pero no pagaron"
        />
      </motion.div>

      {/* FILA 2 — gráfico + tabla | zonas + stats ──────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">

        {/* Columna izquierda */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <BarChart data={stats.asistenciaPorDia} />
          <ClasesHoy clases={stats.clasesHoy} />
        </div>

        {/* Columna derecha */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <ZonaPopularidad data={stats.popularidadPorZona} />
          <QuickStats stats={stats} />
        </div>
      </div>

      {/* FILA 3 — actividad reciente ────────────────────────────────────────── */}
      <ActividadFeed items={stats.actividadReciente} />

    </motion.div>
  )
}
