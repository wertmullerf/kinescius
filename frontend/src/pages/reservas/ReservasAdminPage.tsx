import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  UserGroupIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { clasesApi } from '@/api/endpoints/clases'
import { reservasApi } from '@/api/endpoints/reservas'
import { Modal } from '@/components/ui/Modal'
import { fadeInUp, staggerContainer, staggerItem } from '@/utils/animations'
import { formatTime, estadoLabel, zonaLabel } from '@/utils/formatters'
import { COLORS } from '@/constants/colors'
import type { AgendaMensual, ClaseInstancia, Reserva, EstadoReserva, ZonaClase } from '@/types'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const ZONA_STYLES: Record<ZonaClase, { bg: string; color: string }> = {
  ALTA:  { bg: 'rgba(33,101,88,0.10)',  color: '#216558' },
  MEDIA: { bg: 'rgba(60,207,123,0.15)', color: '#1a7a4a' },
  BAJA:  { bg: 'rgba(237,230,36,0.25)', color: '#92400e' },
}

const ESTADO_COLOR: Record<EstadoReserva, string> = {
  PENDIENTE_PAGO: COLORS.status.PENDIENTE_PAGO,
  RESERVA_PAGA:   COLORS.status.RESERVA_PAGA,
  CONFIRMADA:     COLORS.status.CONFIRMADA,
  CANCELADA:      COLORS.status.CANCELADA,
  COMPLETADA:     COLORS.status.COMPLETADA,
}

function ZonaBadge({ zona }: { zona: ZonaClase }) {
  const s = ZONA_STYLES[zona]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{ backgroundColor: s.bg, color: s.color, borderColor: `${s.color}30` }}
    >
      {zonaLabel[zona]}
    </span>
  )
}

function EstadoBadge({ estado }: { estado: EstadoReserva }) {
  const color = ESTADO_COLOR[estado]
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
      style={{ backgroundColor: `${color}18`, color, borderColor: `${color}35` }}
    >
      {estadoLabel[estado]}
    </span>
  )
}

export function ReservasAdminPage() {
  const [agendas,           setAgendas]           = useState<AgendaMensual[]>([])
  const [agendaIdx,         setAgendaIdx]         = useState(0)
  const [instancias,        setInstancias]        = useState<ClaseInstancia[]>([])
  const [loadingInstancias, setLoadingInstancias] = useState(false)
  const [selectedInstancia, setSelectedInstancia] = useState<ClaseInstancia | null>(null)
  const [reservas,          setReservas]          = useState<Reserva[]>([])
  const [loadingReservas,   setLoadingReservas]   = useState(false)

  useEffect(() => {
    clasesApi.listarAgendas().then(data => {
      const sorted = [...data].sort((a, b) =>
        b.anio !== a.anio ? b.anio - a.anio : b.mes - a.mes
      )
      setAgendas(sorted)
    })
  }, [])

  useEffect(() => {
    if (!agendas.length) return
    setLoadingInstancias(true)
    clasesApi.listarInstancias(agendas[agendaIdx].id)
      .then(setInstancias)
      .finally(() => setLoadingInstancias(false))
  }, [agendas, agendaIdx])

  useEffect(() => {
    if (!selectedInstancia) return
    setLoadingReservas(true)
    reservasApi.listar({ instanciaId: selectedInstancia.id })
      .then(setReservas)
      .finally(() => setLoadingReservas(false))
  }, [selectedInstancia])

  const agenda = agendas[agendaIdx]

  const grouped = instancias.reduce<Record<string, ClaseInstancia[]>>((acc, inst) => {
    const day = new Date(inst.fecha).toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    ;(acc[day] ??= []).push(inst)
    return acc
  }, {})

  function handleInstanciaClick(inst: ClaseInstancia) {
    setSelectedInstancia(inst)
    setReservas([])
  }

  return (
    <motion.div {...fadeInUp} className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Reservas</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Seleccioná una clase para ver quiénes reservaron.
        </p>
      </div>

      {/* Selector de mes */}
      {agendas.length > 0 && agenda && (
        <div className="flex items-center gap-3 mb-5 bg-surface rounded-2xl border border-surface-border px-4 py-3">
          <button
            disabled={agendaIdx >= agendas.length - 1}
            onClick={() => setAgendaIdx(i => i + 1)}
            className="p-1.5 rounded-lg border border-surface-border text-text-secondary hover:text-text-primary hover:border-brand-green disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <span className="flex-1 text-center text-sm font-semibold text-text-primary capitalize">
            {MESES[agenda.mes - 1]} {agenda.anio}
          </span>
          <button
            disabled={agendaIdx <= 0}
            onClick={() => setAgendaIdx(i => i - 1)}
            className="p-1.5 rounded-lg border border-surface-border text-text-secondary hover:text-text-primary hover:border-brand-green disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Lista de instancias */}
      {loadingInstancias ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !agendas.length ? (
        <p className="text-center py-12 text-text-secondary text-sm">No hay agendas creadas.</p>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-center py-12 text-text-secondary text-sm">No hay clases en este mes.</p>
      ) : (
        <motion.div {...staggerContainer} className="space-y-5">
          {Object.entries(grouped).map(([day, insts]) => (
            <motion.div key={day} {...staggerItem}>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 capitalize">
                {day}
              </p>
              <div className="space-y-2">
                {insts.map(inst => {
                  const activas = inst.reservasActivas ?? 0
                  const pct = inst.cupoMaximo > 0 ? activas / inst.cupoMaximo : 0
                  return (
                    <button
                      key={inst.id}
                      onClick={() => handleInstanciaClick(inst)}
                      className="w-full text-left bg-surface rounded-2xl border border-surface-border p-4 hover:border-brand-green transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                            <ClockIcon className="w-4 h-4 text-brand-green" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-text-primary">
                                {formatTime(inst.fecha)}
                              </span>
                              <ZonaBadge zona={inst.zona} />
                              {inst.cancelada && (
                                <span className="text-xs text-status-cancelada font-medium">Cancelada</span>
                              )}
                            </div>
                            <p className="text-xs text-text-secondary mt-0.5">
                              Prof. {inst.profesor.nombre} {inst.profesor.apellido}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <UserGroupIcon className="w-4 h-4 text-text-secondary" />
                          <span className={[
                            'text-sm font-semibold',
                            activas >= inst.cupoMaximo ? 'text-status-cancelada' : 'text-text-primary',
                          ].join(' ')}>
                            {activas}/{inst.cupoMaximo}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 bg-surface-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(pct * 100, 100)}%`,
                            backgroundColor: pct >= 1 ? COLORS.status.CANCELADA : COLORS.brnd.green,
                          }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modal de reservas */}
      <Modal
        open={!!selectedInstancia}
        onClose={() => setSelectedInstancia(null)}
        title={selectedInstancia
          ? `${new Date(selectedInstancia.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${formatTime(selectedInstancia.fecha)}`
          : ''}
        maxWidth="md"
      >
        {selectedInstancia && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ZonaBadge zona={selectedInstancia.zona} />
              <span className="text-xs text-text-secondary">
                Prof. {selectedInstancia.profesor.nombre} {selectedInstancia.profesor.apellido}
              </span>
              <span className="text-xs text-text-secondary ml-auto">
                {selectedInstancia.reservasActivas ?? 0}/{selectedInstancia.cupoMaximo} cupos
              </span>
            </div>

            {loadingReservas ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reservas.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-6">Sin reservas aún.</p>
            ) : (
              <div className="space-y-2">
                {reservas.map(r => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-surface-muted"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {r.cliente?.nombre} {r.cliente?.apellido}
                      </p>
                      <p className="text-xs text-text-secondary">{r.cliente?.email}</p>
                    </div>
                    <EstadoBadge estado={r.estado} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </motion.div>
  )
}
