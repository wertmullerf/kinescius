import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowsRightLeftIcon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { reservasApi } from '@/api/endpoints/reservas'
import { clasesApi } from '@/api/endpoints/clases'
import { colaApi } from '@/api/endpoints/cola'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Toast } from '@/components/ui/Toast'
import { fadeInUp, staggerContainer, staggerItem } from '@/utils/animations'
import { formatCurrency, estadoLabel } from '@/utils/formatters'
import { useAuth } from '@/hooks/useAuth'
import { usePaymentStatus } from '@/hooks/usePaymentStatus'
import { COLORS } from '@/constants/colors'
import type {
  Reserva, ClaseInstancia, AgendaMensual, EstadoReserva, ZonaClase, CrearReservaResult, Profesor, ColaEspera,
} from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      {zona}
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

function esCola(r: CrearReservaResult): r is { posicionCola: number } {
  return 'posicionCola' in r
}

const ESTADOS_ACTIVOS: EstadoReserva[] = ['PENDIENTE_PAGO', 'RESERVA_PAGA', 'CONFIRMADA']

function horasHasta(fecha: string): number {
  return (new Date(fecha).getTime() - Date.now()) / 1000 / 3600
}

// Convierte un Date a YYYY-MM-DD en hora local (para comparar con input date)
function toLocalDateStr(fecha: string | Date): string {
  const d = new Date(fecha)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── BookingResultModal ───────────────────────────────────────────────────────

type BookingOutcome =
  | { type: 'confirmada' }
  | { type: 'pendiente_pago'; initPoint: string }
  | { type: 'cola'; posicion: number }

interface BookingResultModalProps {
  outcome: BookingOutcome | null
  onClose: () => void
}

function BookingResultModal({ outcome, onClose }: BookingResultModalProps) {
  if (!outcome) return null

  return (
    <Modal open={outcome !== null} onClose={onClose} maxWidth="sm">
      <div className="text-center space-y-4">
        {outcome.type === 'confirmada' && (
          <>
            <CheckCircleIcon className="w-14 h-14 text-brand-green mx-auto" />
            <div>
              <p className="font-semibold text-text-primary text-lg">¡Reserva confirmada!</p>
              <p className="text-text-secondary text-sm mt-1">
                Se descontó 1 clase de tu saldo. Te enviamos un email de confirmación.
              </p>
            </div>
          </>
        )}

        {outcome.type === 'pendiente_pago' && (
          <>
            <ClockIcon className="w-14 h-14 text-status-pendiente mx-auto" />
            <div>
              <p className="font-semibold text-text-primary text-lg">Reserva creada</p>
              <p className="text-text-secondary text-sm mt-1">
                Completá el pago de la seña (50%) para confirmar tu lugar.
              </p>
            </div>
            <a
              href={outcome.initPoint}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center w-full py-2.5 px-4 bg-brand-green text-white rounded-lg font-medium text-sm hover:bg-brand-green-dark transition-colors"
            >
              Pagar con Mercado Pago
            </a>
          </>
        )}

        {outcome.type === 'cola' && (
          <>
            <div className="w-14 h-14 rounded-full bg-status-paga/10 flex items-center justify-center mx-auto">
              <span className="text-2xl font-bold text-status-paga">#{outcome.posicion}</span>
            </div>
            <div>
              <p className="font-semibold text-text-primary text-lg">En lista de espera</p>
              <p className="text-text-secondary text-sm mt-1">
                Estás en la posición <strong>{outcome.posicion}</strong> de la cola.
                Te avisaremos por email si se libera un lugar.
              </p>
            </div>
          </>
        )}

        <Button variant="secondary" onClick={onClose} fullWidth>
          {outcome.type === 'pendiente_pago' ? 'Pagar más tarde' : 'Cerrar'}
        </Button>
      </div>
    </Modal>
  )
}

// ─── CancelModal ──────────────────────────────────────────────────────────────

interface CancelModalProps {
  reserva: Reserva | null
  onClose: () => void
  onCancelled: (id: number) => void
}

function CancelModal({ reserva, onClose, onCancelled }: CancelModalProps) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => { if (reserva) setError('') }, [reserva])

  const instancia = reserva?.instancia
  const horas = instancia ? horasHasta(instancia.fecha) : 999

  // Determina la política y si hay penalización activa
  function politica(): { regla: string; consecuencia: string; penaliza: boolean } | null {
    if (!reserva || !instancia) return null

    // CONFIRMADA = fue abonado al reservar (aunque ahora figure como NO_ABONADO por haber usado su última clase)
    if (reserva.estado === 'CONFIRMADA') {
      const penaliza = horas < 48
      return {
        regla: 'Abonados: si cancelás con menos de 48hs de anticipación, se aplica sanción para el próximo mes y perdés el descuento del 20%.',
        consecuencia: penaliza
          ? 'Estás dentro de las 48hs → quedás sancionado/a y no se devuelve la clase a tu saldo.'
          : 'Todavía tenés tiempo → se devuelve 1 clase a tu saldo sin penalización.',
        penaliza,
      }
    }

    if (reserva.estado === 'RESERVA_PAGA') {
      const penaliza = horas < 24
      return {
        regla: 'No abonados: si cancelás con menos de 24hs de anticipación, no se devuelve la seña.',
        consecuencia: penaliza
          ? 'Estás dentro de las 24hs → perdés la seña abonada.'
          : 'Todavía tenés tiempo → la seña se reembolsa vía Mercado Pago.',
        penaliza,
      }
    }

    if (reserva.estado === 'PENDIENTE_PAGO') {
      return { regla: '', consecuencia: 'Cancelación sin cargo, no realizaste ningún pago.', penaliza: false }
    }

    return null
  }

  const pol = politica()

  async function handleCancel() {
    if (!reserva) return
    setLoading(true)
    setError('')
    try {
      await reservasApi.cancelar(reserva.id)
      onCancelled(reserva.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cancelar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={reserva !== null} onClose={onClose} title="Cancelar reserva" maxWidth="sm">
      <div className="space-y-4">
        {instancia && (
          <div className="bg-surface-muted rounded-xl p-3 text-sm">
            <p className="font-medium text-text-primary">
              {new Date(instancia.fecha).toLocaleDateString('es-AR', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
              {' · '}
              {new Date(instancia.fecha).toLocaleTimeString('es-AR', {
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
            <p className="text-text-secondary mt-0.5">Zona {instancia.zona}</p>
          </div>
        )}

        {pol && (
          <div className="space-y-2">
            {pol.regla && (
              <div className="flex items-start gap-2 text-xs text-text-secondary bg-surface-muted rounded-xl px-3 py-2.5">
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-text-secondary" />
                <p>{pol.regla}</p>
              </div>
            )}
            <div className={[
              'flex items-start gap-2 text-sm rounded-xl px-3 py-2.5',
              pol.penaliza
                ? 'bg-status-cancelada/10 text-status-cancelada'
                : 'bg-brand-green/10 text-brand-green-dark',
            ].join(' ')}>
              <ExclamationTriangleIcon className={[
                'w-4 h-4 flex-shrink-0 mt-0.5',
                pol.penaliza ? 'text-status-cancelada' : 'text-brand-green',
              ].join(' ')} />
              <p className="font-medium">{pol.consecuencia}</p>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-status-cancelada bg-status-cancelada/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} type="button" fullWidth>
            Volver
          </Button>
          <Button variant="danger" onClick={handleCancel} loading={loading} fullWidth>
            Confirmar cancelación
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── CambiarModal ─────────────────────────────────────────────────────────────

interface CambiarModalProps {
  reserva: Reserva | null
  allAgendas: AgendaMensual[]
  onClose: () => void
  onChanged: (reserva: Reserva) => void
}

function CambiarModal({ reserva, allAgendas, onClose, onChanged }: CambiarModalProps) {
  const [opciones,  setOpciones]  = useState<ClaseInstancia[]>([])
  const [selected,  setSelected]  = useState<number | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [loadingOp, setLoadingOp] = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    if (!reserva?.instancia) return
    setLoadingOp(true)
    setSelected(null)
    setError('')

    const inst = reserva.instancia
    const fecha = new Date(inst.fecha)
    const mes   = fecha.getMonth() + 1
    const anio  = fecha.getFullYear()
    const fechaStr = inst.fecha.split('T')[0]

    const agenda = allAgendas.find(a => a.mes === mes && a.anio === anio)
    if (!agenda) {
      setOpciones([])
      setLoadingOp(false)
      return
    }

    clasesApi.listarInstancias(agenda.id, { fecha: fechaStr, zona: inst.zona })
      .then(list => {
        setOpciones(list.filter(i =>
          i.id !== inst.id &&
          !i.cancelada &&
          (i.reservasActivas ?? 0) < i.cupoMaximo
        ))
      })
      .catch(() => setError('No se pudieron cargar las opciones'))
      .finally(() => setLoadingOp(false))
  }, [reserva, allAgendas])

  async function handleCambiar() {
    if (!reserva || !selected) return
    setLoading(true)
    setError('')
    try {
      const updated = await reservasApi.cambiar(reserva.id, selected)
      onChanged(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={reserva !== null} onClose={onClose} title="Cambiar clase" maxWidth="sm">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Seleccioná una clase disponible del mismo día y zona.
        </p>

        {loadingOp ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : opciones.length === 0 ? (
          <div className="text-center py-6 text-text-secondary text-sm">
            No hay otras clases disponibles para ese día y zona.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {opciones.map(op => (
              <button
                key={op.id}
                onClick={() => setSelected(op.id)}
                className={[
                  'w-full text-left px-4 py-3 rounded-xl border transition-colors',
                  selected === op.id
                    ? 'border-brand-green bg-brand-green/10'
                    : 'border-surface-border hover:bg-surface-muted',
                ].join(' ')}
              >
                <p className="text-sm font-medium text-text-primary">
                  {new Date(op.fecha).toLocaleTimeString('es-AR', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                  {' · '}{op.duracion} min
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {op.profesor ? `${op.profesor.nombre} ${op.profesor.apellido}` : '—'}
                  {' · '}{op.cupoMaximo - (op.reservasActivas ?? 0)} lugares disponibles
                </p>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-status-cancelada">{error}</p>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} type="button" fullWidth>
            Cancelar
          </Button>
          <Button
            onClick={handleCambiar}
            loading={loading}
            disabled={!selected}
            fullWidth
          >
            Confirmar cambio
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── FiltrosBar ───────────────────────────────────────────────────────────────

interface FiltrosBarProps {
  zonaFilter:      ZonaClase | null
  fechaFilter:     string
  profesorFilter:  number | null
  profesores:      Profesor[]
  onZona:          (z: ZonaClase | null) => void
  onFecha:         (f: string) => void
  onProfesor:      (p: number | null) => void
  activos:         number
}

const ZONAS: ZonaClase[] = ['ALTA', 'MEDIA', 'BAJA']

function FiltrosBar({
  zonaFilter, fechaFilter, profesorFilter, profesores,
  onZona, onFecha, onProfesor, activos,
}: FiltrosBarProps) {
  const hayFiltros = zonaFilter !== null || fechaFilter !== '' || profesorFilter !== null

  return (
    <div className="bg-surface rounded-2xl border border-surface-border p-4 mb-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-4 h-4 text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">Filtros</span>
          {hayFiltros && (
            <span className="text-xs bg-brand-green text-white px-1.5 py-0.5 rounded-full font-medium">
              {activos}
            </span>
          )}
        </div>
        {hayFiltros && (
          <button
            onClick={() => { onZona(null); onFecha(''); onProfesor(null) }}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-status-cancelada transition-colors"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
            Limpiar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Fecha */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1.5">Fecha</p>
          <input
            type="date"
            value={fechaFilter}
            onChange={e => onFecha(e.target.value)}
            className="w-full rounded-lg bg-surface-muted border border-transparent text-text-primary text-sm px-3 py-2 outline-none focus:border-brand-green focus:bg-white transition-colors"
          />
        </div>

        {/* Zona */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1.5">Zona</p>
          <div className="flex gap-1.5">
            {ZONAS.map(z => (
              <button
                key={z}
                onClick={() => onZona(zonaFilter === z ? null : z)}
                className={[
                  'flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors',
                  zonaFilter === z
                    ? 'bg-brand-green text-white border-brand-green'
                    : 'border-surface-border text-text-secondary hover:border-brand-green hover:text-brand-green',
                ].join(' ')}
              >
                {z}
              </button>
            ))}
          </div>
        </div>

        {/* Profesor */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1.5">Profesor</p>
          <select
            value={profesorFilter ?? ''}
            onChange={e => onProfesor(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg bg-surface-muted border border-transparent text-text-primary text-sm px-3 py-2 outline-none focus:border-brand-green focus:bg-white transition-colors"
          >
            <option value="">Todos</option>
            {profesores.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.apellido}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Explorar ────────────────────────────────────────────────────────────

interface ExplorarTabProps {
  reservas: Reserva[]
  onReservaCreated: (result: CrearReservaResult, inst: ClaseInstancia) => void
}

function ExplorarTab({ reservas, onReservaCreated }: ExplorarTabProps) {
  const { user } = useAuth()

  const [currentDate,  setCurrentDate]  = useState(new Date())
  const [allAgendas,   setAllAgendas]   = useState<AgendaMensual[]>([])
  const [agenda,       setAgenda]       = useState<AgendaMensual | null>(null)
  const [instancias,   setInstancias]   = useState<ClaseInstancia[]>([])
  const [loadingInit,  setLoadingInit]  = useState(true)
  const [loadingInst,  setLoadingInst]  = useState(false)
  const [bookingId,    setBookingId]    = useState<number | null>(null)
  const [inQueue,      setInQueue]      = useState<Set<number>>(new Set())

  // Cargar las colas activas del usuario para mostrar "Ya estás en lista de espera"
  useEffect(() => {
    colaApi.misEntradas().then(entries => {
      setInQueue(new Set(entries.map(e => e.instanciaId)))
    }).catch(() => { /* silencioso: si falla, el usuario ve el botón de unirse igualmente */ })
  }, [])

  // Filtros
  const [zonaFilter,     setZonaFilter]     = useState<ZonaClase | null>(null)
  const [fechaFilter,    setFechaFilter]    = useState('')
  const [profesorFilter, setProfesorFilter] = useState<number | null>(null)

  const reservasPorInstancia = useMemo(() => {
    const map = new Map<number, Reserva>()
    for (const r of reservas) {
      if (ESTADOS_ACTIVOS.includes(r.estado)) map.set(r.instanciaId, r)
    }
    return map
  }, [reservas])

  // Lista de profesores únicos del mes cargado
  const profesores = useMemo(() => {
    const seen = new Set<number>()
    const list: Profesor[] = []
    for (const inst of instancias) {
      if (inst.profesor && !seen.has(inst.profesor.id)) {
        seen.add(inst.profesor.id)
        list.push(inst.profesor)
      }
    }
    return list.sort((a, b) =>
      `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)
    )
  }, [instancias])

  // Instancias filtradas
  const instanciasFiltradas = useMemo(() => {
    return instancias.filter(inst => {
      if (zonaFilter && inst.zona !== zonaFilter) return false
      if (fechaFilter && toLocalDateStr(inst.fecha) !== fechaFilter) return false
      if (profesorFilter && inst.profesor?.id !== profesorFilter) return false
      return true
    })
  }, [instancias, zonaFilter, fechaFilter, profesorFilter])

  const filtrosActivos = [zonaFilter, fechaFilter || null, profesorFilter].filter(Boolean).length

  useEffect(() => {
    clasesApi.listarAgendas()
      .then(setAllAgendas)
      .finally(() => setLoadingInit(false))
  }, [])

  useEffect(() => {
    if (loadingInit) return
    const mes  = currentDate.getMonth() + 1
    const anio = currentDate.getFullYear()
    setAgenda(allAgendas.find(a => a.mes === mes && a.anio === anio) ?? null)
    setInstancias([])
    // Limpiar filtros al cambiar de mes
    setFechaFilter('')
  }, [currentDate, allAgendas, loadingInit])

  useEffect(() => {
    if (!agenda) return
    setLoadingInst(true)
    clasesApi.listarInstancias(agenda.id)
      .then(list => {
        const now = Date.now()
        setInstancias(
          list
            .filter(i => !i.cancelada && new Date(i.fecha).getTime() > now)
            .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
        )
      })
      .finally(() => setLoadingInst(false))
  }, [agenda])

  const mesLabel = currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  function prevMonth() {
    setCurrentDate(d => { const p = new Date(d); p.setDate(1); p.setMonth(p.getMonth() - 1); return p })
  }
  function nextMonth() {
    setCurrentDate(d => { const n = new Date(d); n.setDate(1); n.setMonth(n.getMonth() + 1); return n })
  }

  async function handleReservar(inst: ClaseInstancia) {
    setBookingId(inst.id)
    try {
      const result = await reservasApi.crear(inst.id)
      onReservaCreated(result, inst)
      if (!esCola(result)) {
        setInstancias(prev => prev.map(i =>
          i.id === inst.id ? { ...i, reservasActivas: (i.reservasActivas ?? 0) + 1 } : i
        ))
      } else {
        setInQueue(prev => new Set(prev).add(inst.id))
      }
    } finally {
      setBookingId(null)
    }
  }

  async function handleCola(inst: ClaseInstancia) {
    setBookingId(inst.id)
    try {
      const result = await colaApi.unirse(inst.id)
      onReservaCreated({ posicionCola: result.posicion }, inst)
      setInQueue(prev => new Set(prev).add(inst.id))
    } finally {
      setBookingId(null)
    }
  }

  if (loadingInit) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-7 h-7 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Navegación de mes */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-surface-muted text-text-secondary transition-colors">
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-text-primary capitalize min-w-40 text-center">
          {mesLabel}
        </span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-surface-muted text-text-secondary transition-colors">
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>

      {!agenda ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CalendarDaysIcon className="w-14 h-14 text-surface-border mb-4" />
          <p className="text-text-secondary text-sm">
            No hay clases programadas para {mesLabel}.
          </p>
        </div>
      ) : loadingInst ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : instancias.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CalendarDaysIcon className="w-14 h-14 text-surface-border mb-4" />
          <p className="text-text-secondary text-sm">
            No quedan clases futuras para {mesLabel}.
          </p>
        </div>
      ) : (
        <>
          <FiltrosBar
            zonaFilter={zonaFilter}
            fechaFilter={fechaFilter}
            profesorFilter={profesorFilter}
            profesores={profesores}
            onZona={setZonaFilter}
            onFecha={setFechaFilter}
            onProfesor={setProfesorFilter}
            activos={filtrosActivos}
          />

          {instanciasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FunnelIcon className="w-10 h-10 text-surface-border mb-3" />
              <p className="text-text-secondary text-sm">
                No hay clases que coincidan con los filtros.
              </p>
              <button
                onClick={() => { setZonaFilter(null); setFechaFilter(''); setProfesorFilter(null) }}
                className="mt-2 text-xs text-brand-green hover:underline"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {instanciasFiltradas.map(inst => {
                const fecha            = new Date(inst.fecha)
                const reservaExistente = reservasPorInstancia.get(inst.id)
                const activas          = inst.reservasActivas ?? 0
                const disponibles      = inst.cupoMaximo - activas
                const completo         = disponibles <= 0
                const yaEnCola         = inQueue.has(inst.id)
                const cargando         = bookingId === inst.id

                return (
                  <motion.div
                    key={inst.id}
                    variants={staggerItem}
                    className="bg-surface rounded-3xl shadow-card border border-surface-border p-5 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-bold text-text-primary">
                          {fecha.toLocaleDateString('es-AR', {
                            weekday: 'short', day: 'numeric', month: 'short',
                          })}
                        </p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}{inst.duracion} min
                        </p>
                      </div>
                      <ZonaBadge zona={inst.zona} />
                    </div>

                    <p className="text-xs text-text-secondary">
                      {inst.profesor
                        ? `${inst.profesor.nombre} ${inst.profesor.apellido}`
                        : '—'}
                    </p>

                    <div className="flex items-center justify-between">
                      {completo ? (
                        <span className="text-xs font-medium text-status-cancelada">Sin cupo</span>
                      ) : disponibles <= Math.ceil(inst.cupoMaximo * 0.2) ? (
                        <span className="text-xs font-medium text-status-pendiente">
                          Último{disponibles !== 1 ? 's' : ''} {disponibles} lugar{disponibles !== 1 ? 'es' : ''}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-brand-green">
                          {disponibles} lugar{disponibles !== 1 ? 'es' : ''} disponibles
                        </span>
                      )}
                      <span className="text-xs text-text-secondary font-medium">
                        {formatCurrency(inst.precio)}
                      </span>
                    </div>

                    {reservaExistente ? (
                      <div className="flex items-center gap-2 bg-brand-green/10 rounded-xl px-3 py-2">
                        <CheckCircleIcon className="w-4 h-4 text-brand-green flex-shrink-0" />
                        <span className="text-xs font-medium text-brand-green-dark">
                          {estadoLabel[reservaExistente.estado]}
                        </span>
                      </div>
                    ) : yaEnCola ? (
                      <div className="flex items-center gap-2 bg-status-paga/10 rounded-xl px-3 py-2">
                        <ClockIcon className="w-4 h-4 text-status-paga flex-shrink-0" />
                        <span className="text-xs font-medium text-status-paga">En lista de espera</span>
                      </div>
                    ) : completo ? (
                      <button
                        onClick={() => handleCola(inst)}
                        disabled={cargando || !user}
                        className="w-full py-2 rounded-xl border border-status-paga text-status-paga text-xs font-medium hover:bg-status-paga/10 transition-colors disabled:opacity-50"
                      >
                        {cargando ? 'Uniéndose...' : 'Unirse a lista de espera'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReservar(inst)}
                        disabled={cargando || !user}
                        className="w-full py-2 rounded-xl bg-brand-green text-white text-xs font-semibold hover:bg-brand-green-dark transition-colors disabled:opacity-50"
                      >
                        {cargando ? 'Reservando...' : 'Reservar'}
                      </button>
                    )}
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tab: Mis Reservas ────────────────────────────────────────────────────────

interface MisReservasTabProps {
  reservas: Reserva[]
  loading: boolean
  allAgendas: AgendaMensual[]
  onCancelClick: (r: Reserva) => void
  onCambiarClick: (r: Reserva) => void
  onReservaCreated: (result: CrearReservaResult, inst: ClaseInstancia) => void
}

function ColaCard({
  entrada,
  confirmando,
  error,
  onConfirmar,
}: {
  entrada:     ColaEspera
  confirmando: boolean
  error:       string
  onConfirmar: () => void
}) {
  const inst   = entrada.instancia
  const expira = entrada.expiraEn ? new Date(entrada.expiraEn) : null

  return (
    <div className="bg-brand-green/5 border border-brand-green/40 rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {inst ? (
            <>
              <p className="text-sm font-semibold text-text-primary capitalize">
                {new Date(inst.fecha).toLocaleDateString('es-AR', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {new Date(inst.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                {' · '}{inst.duracion} min
                {inst.profesor && ` · ${inst.profesor.nombre} ${inst.profesor.apellido}`}
              </p>
            </>
          ) : (
            <p className="text-sm text-text-secondary">Clase #{entrada.instanciaId}</p>
          )}
        </div>
        {inst && <ZonaBadge zona={inst.zona} />}
      </div>

      {expira && (
        <div className="flex items-center gap-1.5 bg-status-pendiente/10 rounded-xl px-3 py-2 mb-3">
          <ClockIcon className="w-3.5 h-3.5 text-status-pendiente flex-shrink-0" />
          <p className="text-xs text-status-pendiente font-medium">
            Confirmá antes del{' '}
            {expira.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}{' '}
            a las{' '}
            {expira.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}

      <button
        onClick={onConfirmar}
        disabled={confirmando}
        className="w-full py-2.5 rounded-xl bg-brand-green text-white text-xs font-semibold hover:bg-brand-green-dark transition-colors disabled:opacity-60"
      >
        {confirmando ? 'Confirmando...' : 'Confirmar reserva'}
      </button>

      {error && <p className="text-xs text-status-cancelada mt-2">{error}</p>}
    </div>
  )
}

function MisReservasTab({
  reservas,
  loading,
  allAgendas,
  onCancelClick,
  onCambiarClick,
  onReservaCreated,
}: MisReservasTabProps) {
  const [colaConPrioridad, setColaConPrioridad] = useState<ColaEspera[]>([])
  const [loadingCola,      setLoadingCola]      = useState(true)
  const [confirmandoId,    setConfirmandoId]    = useState<number | null>(null)
  const [confirmError,     setConfirmError]     = useState<Record<number, string>>({})

  useEffect(() => {
    colaApi.misEntradas()
      .then(entries => {
        const ahora = new Date()
        setColaConPrioridad(
          entries.filter(e => e.expiraEn && new Date(e.expiraEn) > ahora)
        )
      })
      .finally(() => setLoadingCola(false))
  }, [])

  async function handleConfirmar(entrada: ColaEspera) {
    if (!entrada.instancia) return
    setConfirmandoId(entrada.instanciaId)
    setConfirmError(prev => ({ ...prev, [entrada.instanciaId]: '' }))
    try {
      const result = await reservasApi.crear(entrada.instanciaId)
      onReservaCreated(result, entrada.instancia)
      setColaConPrioridad(prev => prev.filter(e => e.instanciaId !== entrada.instanciaId))
    } catch (err) {
      setConfirmError(prev => ({
        ...prev,
        [entrada.instanciaId]: err instanceof Error ? err.message : 'Error al confirmar',
      }))
    } finally {
      setConfirmandoId(null)
    }
  }

  const activas     = reservas.filter(r => ESTADOS_ACTIVOS.includes(r.estado))
  const historiales = reservas.filter(r => !ESTADOS_ACTIVOS.includes(r.estado))
  const isLoading   = loading || loadingCola

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-7 h-7 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasContent = colaConPrioridad.length > 0 || reservas.length > 0

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CalendarDaysIcon className="w-14 h-14 text-surface-border mb-4" />
        <p className="text-text-primary font-medium mb-1">Sin reservas todavía</p>
        <p className="text-text-secondary text-sm">
          Explorá las clases disponibles y reservá tu lugar.
        </p>
      </div>
    )
  }

  function ReservaCard({ r }: { r: Reserva }) {
    const [loadingPago, setLoadingPago] = useState(false)
    const [errorPago,   setErrorPago]   = useState('')

    const inst     = r.instancia
    const esActiva = ESTADOS_ACTIVOS.includes(r.estado)

    async function handleIrAPagar() {
      setLoadingPago(true)
      setErrorPago('')
      try {
        const { initPoint } = await reservasApi.obtenerInitPoint(r.id)
        window.open(initPoint, '_blank', 'noopener,noreferrer')
      } catch (err) {
        setErrorPago(err instanceof Error ? err.message : 'Error al obtener el link de pago')
      } finally {
        setLoadingPago(false)
      }
    }

    return (
      <motion.div
        variants={staggerItem}
        className="bg-surface rounded-3xl shadow-card border border-surface-border p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {inst ? (
              <>
                <p className="text-sm font-semibold text-text-primary">
                  {new Date(inst.fecha).toLocaleDateString('es-AR', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {new Date(inst.fecha).toLocaleTimeString('es-AR', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                  {' · '}{inst.duracion} min
                  {' · '}Zona {inst.zona}
                </p>
                {inst.profesor && (
                  <p className="text-xs text-text-secondary mt-0.5">
                    {inst.profesor.nombre} {inst.profesor.apellido}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-text-secondary">Clase #{r.instanciaId}</p>
            )}
          </div>
          <EstadoBadge estado={r.estado} />
        </div>

        {/* Pago pendiente: botón para ir a pagar */}
        {r.estado === 'PENDIENTE_PAGO' && (
          <div className="mt-3 space-y-2">
            <button
              onClick={handleIrAPagar}
              disabled={loadingPago}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-green text-white text-xs font-semibold hover:bg-brand-green-dark transition-colors disabled:opacity-60"
            >
              <ClockIcon className="w-3.5 h-3.5" />
              {loadingPago ? 'Generando link...' : 'Ir a pagar (50% de seña)'}
            </button>
            {errorPago && (
              <p className="text-xs text-status-cancelada">{errorPago}</p>
            )}
          </div>
        )}

        {/* Acciones */}
        {esActiva && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onCambiarClick(r)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary border border-surface-border hover:bg-surface-muted transition-colors"
            >
              <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
              Cambiar
            </button>
            <button
              onClick={() => onCancelClick(r)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-status-cancelada border border-status-cancelada/30 hover:bg-status-cancelada/10 transition-colors"
            >
              <XCircleIcon className="w-3.5 h-3.5" />
              Cancelar
            </button>
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cupos disponibles desde la cola de espera */}
      {colaConPrioridad.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-green mb-3">
            Cupo disponible — confirmá antes de que expire
          </h3>
          <div className="space-y-3">
            {colaConPrioridad.map(entrada => (
              <ColaCard
                key={entrada.id}
                entrada={entrada}
                confirmando={confirmandoId === entrada.instanciaId}
                error={confirmError[entrada.instanciaId] ?? ''}
                onConfirmar={() => handleConfirmar(entrada)}
              />
            ))}
          </div>
        </div>
      )}

      {activas.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
            Próximas
          </h3>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {activas.map(r => <ReservaCard key={r.id} r={r} />)}
          </motion.div>
        </div>
      )}

      {historiales.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
            Historial
          </h3>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {historiales.slice(0, 10).map(r => <ReservaCard key={r.id} r={r} />)}
          </motion.div>
        </div>
      )}

      <div className="hidden" aria-hidden>{allAgendas.length}</div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'explorar' | 'mis-reservas'

const PAYMENT_TOAST: Record<string, { message: string; type: 'success' | 'error' | 'info' }> = {
  success: { message: '¡Pago confirmado! Tu reserva quedó activa.', type: 'success' },
  failure: { message: 'El pago no se procesó. Podés intentarlo de nuevo desde "Mis reservas".', type: 'error' },
  pending: { message: 'Tu pago está en proceso. Te avisaremos por email cuando se confirme.', type: 'info' },
}

export function ReservasPage() {
  const { refreshUser } = useAuth()
  const { paymentStatus, clearPaymentStatus } = usePaymentStatus()

  const [tab, setTab] = useState<Tab>('explorar')

  const [reservas,        setReservas]        = useState<Reserva[]>([])
  const [loadingReservas, setLoadingReservas]  = useState(true)
  const [allAgendas,      setAllAgendas]       = useState<AgendaMensual[]>([])

  const [bookingOutcome, setBookingOutcome] = useState<BookingOutcome | null>(null)
  const [cancelTarget,   setCancelTarget]   = useState<Reserva | null>(null)
  const [cambiarTarget,  setCambiarTarget]  = useState<Reserva | null>(null)

  useEffect(() => {
    Promise.all([
      reservasApi.listar(),
      clasesApi.listarAgendas(),
    ]).then(([rs, agendas]) => {
      setReservas(rs)
      setAllAgendas(agendas)
    }).finally(() => setLoadingReservas(false))
  }, [])

  const handleReservaCreated = useCallback(async (result: CrearReservaResult, _inst: ClaseInstancia) => {
    if (esCola(result)) {
      setBookingOutcome({ type: 'cola', posicion: result.posicionCola })
    } else {
      const reserva = result as Reserva & { initPoint?: string }
      if (reserva.initPoint) {
        setBookingOutcome({ type: 'pendiente_pago', initPoint: reserva.initPoint })
      } else {
        setBookingOutcome({ type: 'confirmada' })
        await refreshUser()
      }
      setReservas(prev => [reserva, ...prev])
    }
  }, [refreshUser])

  function handleCancelled(id: number) {
    setReservas(prev =>
      prev.map(r => r.id === id ? { ...r, estado: 'CANCELADA' as EstadoReserva } : r)
    )
  }

  function handleChanged(updated: Reserva) {
    setReservas(prev => prev.map(r => r.id === updated.id ? updated : r))
  }

  return (
    <motion.div {...fadeInUp}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">Reservas</h1>
      </div>

      <div className="flex gap-1 bg-surface-muted p-1 rounded-xl w-fit mb-6">
        {(['explorar', 'mis-reservas'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t
                ? 'bg-surface text-text-primary shadow-card'
                : 'text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            {t === 'explorar' ? 'Explorar clases' : 'Mis reservas'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'explorar' ? (
          <motion.div key="explorar" {...fadeInUp}>
            <ExplorarTab
              reservas={reservas}
              onReservaCreated={handleReservaCreated}
            />
          </motion.div>
        ) : (
          <motion.div key="mis-reservas" {...fadeInUp}>
            <MisReservasTab
              reservas={reservas}
              loading={loadingReservas}
              allAgendas={allAgendas}
              onCancelClick={setCancelTarget}
              onCambiarClick={setCambiarTarget}
              onReservaCreated={handleReservaCreated}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <BookingResultModal
        outcome={bookingOutcome}
        onClose={() => setBookingOutcome(null)}
      />

      <CancelModal
        reserva={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={handleCancelled}
      />

      <CambiarModal
        reserva={cambiarTarget}
        allAgendas={allAgendas}
        onClose={() => setCambiarTarget(null)}
        onChanged={handleChanged}
      />

      {paymentStatus && (
        <Toast
          message={PAYMENT_TOAST[paymentStatus].message}
          type={PAYMENT_TOAST[paymentStatus].type}
          onClose={clearPaymentStatus}
        />
      )}
    </motion.div>
  )
}
