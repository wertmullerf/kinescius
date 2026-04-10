import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { clasesApi } from '@/api/endpoints/clases'
import { profesoresApi } from '@/api/endpoints/profesores'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { fadeInUp, staggerContainer, staggerItem } from '@/utils/animations'
import { formatCurrency } from '@/utils/formatters'
import { useAuth } from '@/hooks/useAuth'
import type { AgendaMensual, ClaseRecurrente, ClaseInstancia, Profesor, ZonaClase } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const ZONA_STYLES: Record<ZonaClase, { bg: string; color: string }> = {
  ALTA:  { bg: 'rgba(33,101,88,0.10)',  color: '#216558' },
  MEDIA: { bg: 'rgba(60,207,123,0.15)', color: '#1a7a4a' },
  BAJA:  { bg: 'rgba(237,230,36,0.25)', color: '#92400e' },
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

function CupoBadge({ activas = 0, maximo }: { activas?: number; maximo: number }) {
  const pct = maximo > 0 ? activas / maximo : 0
  const color = pct >= 1 ? '#ef4444' : pct >= 0.8 ? '#f59e0b' : '#3ccf7b'
  const label = pct >= 1 ? 'Completo' : pct >= 0.8 ? 'Últimos lugares' : 'Disponible'
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{ backgroundColor: `${color}20`, color, borderColor: `${color}40` }}
    >
      {label} · {activas}/{maximo}
    </span>
  )
}

// ─── Modal — Patrón recurrente ────────────────────────────────────────────────

interface PatronModalProps {
  open: boolean
  agendaId: number
  patron: ClaseRecurrente | null
  profesores: Profesor[]
  onClose: () => void
  onSaved: (p: ClaseRecurrente, isNew: boolean) => void
}

const PATRON_INITIAL = {
  diaSemana: 1,
  hora: '09:00',
  zona: 'BAJA' as ZonaClase,
  cupoMaximo: 6,
  duracion: 60,
  precio: 5000,
  profesorId: 0,
}

function PatronModal({ open, agendaId, patron, profesores, onClose, onSaved }: PatronModalProps) {
  const [form,     setForm]     = useState(PATRON_INITIAL)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  useEffect(() => {
    if (open) {
      setError('')
      setSuccess('')
      setForm(patron
        ? { diaSemana: patron.diaSemana, hora: patron.hora, zona: patron.zona,
            cupoMaximo: patron.cupoMaximo, duracion: patron.duracion,
            precio: patron.precio, profesorId: patron.profesorId }
        : { ...PATRON_INITIAL, profesorId: profesores[0]?.id ?? 0 }
      )
    }
  }, [open, patron, profesores])

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.profesorId) { setError('Seleccioná un profesor'); return }
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (patron) {
        const updated = await clasesApi.editarRecurrente(agendaId, patron.id, form)
        onSaved(updated, false)
        onClose()
      } else {
        const created = await clasesApi.crearRecurrente(agendaId, form)
        setSuccess('Patrón creado. Las instancias del mes fueron generadas automáticamente.')
        onSaved(created, true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={patron ? 'Editar clase fija' : 'Nueva clase fija'}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Día de semana */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-primary">Día</label>
            <select
              value={form.diaSemana}
              onChange={e => set('diaSemana', Number(e.target.value))}
              className="w-full rounded-lg bg-surface-muted text-text-primary border border-transparent outline-none focus:border-brand-green px-3 py-2.5 text-sm"
            >
              {DIAS_SEMANA.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>

          {/* Hora */}
          <Input
            id="phora"
            label="Hora"
            type="time"
            value={form.hora}
            onChange={e => set('hora', e.target.value)}
            required
          />
        </div>

        {/* Zona */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-primary">Zona</label>
          <select
            value={form.zona}
            onChange={e => set('zona', e.target.value as ZonaClase)}
            className="w-full rounded-lg bg-surface-muted text-text-primary border border-transparent outline-none focus:border-brand-green px-3 py-2.5 text-sm"
          >
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="pcupo"
            label="Cupo"
            type="number"
            min={1}
            value={form.cupoMaximo}
            onChange={e => set('cupoMaximo', Number(e.target.value))}
            required
          />
          <Input
            id="pduracion"
            label="Duración (min)"
            type="number"
            min={15}
            value={form.duracion}
            onChange={e => set('duracion', Number(e.target.value))}
            required
          />
          <Input
            id="pprecio"
            label="Precio ($)"
            type="number"
            min={0}
            value={form.precio}
            onChange={e => set('precio', Number(e.target.value))}
            required
          />
        </div>

        {/* Profesor */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-primary">Profesor</label>
          <select
            value={form.profesorId}
            onChange={e => set('profesorId', Number(e.target.value))}
            className="w-full rounded-lg bg-surface-muted text-text-primary border border-transparent outline-none focus:border-brand-green px-3 py-2.5 text-sm"
          >
            <option value={0} disabled>Seleccioná un profesor</option>
            {profesores.map(p => (
              <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
            ))}
          </select>
        </div>

        {error   && <p className="text-sm text-status-cancelada">{error}</p>}
        {success && <p className="text-sm text-brand-green-dark bg-brand-green/10 rounded-lg px-3 py-2">{success}</p>}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} type="button" fullWidth>
            {success ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!success && (
            <Button type="submit" loading={loading} fullWidth>
              {patron ? 'Guardar cambios' : 'Crear clase'}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal — Clase suelta ─────────────────────────────────────────────────────

interface SueltaModalProps {
  open: boolean
  profesores: Profesor[]
  onClose: () => void
  onCreated: (i: ClaseInstancia) => void
}

const SUELTA_INITIAL = {
  fecha: '',
  zona: 'BAJA' as ZonaClase,
  cupoMaximo: 6,
  duracion: 60,
  precio: 5000,
  profesorId: 0,
}

function SueltaModal({ open, profesores, onClose, onCreated }: SueltaModalProps) {
  const [form,    setForm]    = useState(SUELTA_INITIAL)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (open) {
      setError('')
      setForm({ ...SUELTA_INITIAL, profesorId: profesores[0]?.id ?? 0 })
    }
  }, [open, profesores])

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.profesorId) { setError('Seleccioná un profesor'); return }
    if (!form.fecha)       { setError('Ingresá fecha y hora');   return }
    setLoading(true)
    setError('')

    try {
      // datetime-local value: "2026-04-15T10:00" → ISO string
      const created = await clasesApi.crearSuelta({
        ...form,
        fecha: new Date(form.fecha).toISOString(),
      })
      onCreated(created)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva clase suelta" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="sfecha"
          label="Fecha y hora"
          type="datetime-local"
          value={form.fecha}
          onChange={e => set('fecha', e.target.value)}
          required
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-primary">Zona</label>
          <select
            value={form.zona}
            onChange={e => set('zona', e.target.value as ZonaClase)}
            className="w-full rounded-lg bg-surface-muted text-text-primary border border-transparent outline-none focus:border-brand-green px-3 py-2.5 text-sm"
          >
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="scupo"
            label="Cupo"
            type="number"
            min={1}
            value={form.cupoMaximo}
            onChange={e => set('cupoMaximo', Number(e.target.value))}
            required
          />
          <Input
            id="sduracion"
            label="Duración (min)"
            type="number"
            min={15}
            value={form.duracion}
            onChange={e => set('duracion', Number(e.target.value))}
            required
          />
          <Input
            id="sprecio"
            label="Precio ($)"
            type="number"
            min={0}
            value={form.precio}
            onChange={e => set('precio', Number(e.target.value))}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-primary">Profesor</label>
          <select
            value={form.profesorId}
            onChange={e => set('profesorId', Number(e.target.value))}
            className="w-full rounded-lg bg-surface-muted text-text-primary border border-transparent outline-none focus:border-brand-green px-3 py-2.5 text-sm"
          >
            <option value={0} disabled>Seleccioná un profesor</option>
            {profesores.map(p => (
              <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-status-cancelada">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} type="button" fullWidth>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} fullWidth>
            Crear clase
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

interface DeletePatronModalProps {
  open: boolean
  patron: ClaseRecurrente | null
  agendaId: number
  onClose: () => void
  onDeleted: (id: number) => void
}

function DeletePatronModal({ open, patron, agendaId, onClose, onDeleted }: DeletePatronModalProps) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => { if (open) setError('') }, [open])

  async function handleDelete() {
    if (!patron) return
    setLoading(true)
    setError('')
    try {
      await clasesApi.eliminarRecurrente(agendaId, patron.id)
      onDeleted(patron.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Eliminar clase fija" maxWidth="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-status-cancelada/10 flex items-center justify-center">
            <ExclamationTriangleIcon className="w-5 h-5 text-status-cancelada" />
          </div>
          <p className="text-sm text-text-secondary pt-2">
            Se eliminarán las instancias futuras sin reservas de este patrón.
            Las clases pasadas o con reservas se conservan.
          </p>
        </div>
        {error && (
          <p className="text-sm text-status-cancelada bg-status-cancelada/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} type="button" fullWidth>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={loading} fullWidth>
            Eliminar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'agenda' | 'sueltas'

export function ClasesPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'ADMIN'

  const [tab,         setTab]         = useState<Tab>('agenda')
  const [currentDate, setCurrentDate] = useState(new Date())

  // Data
  const [allAgendas,  setAllAgendas]  = useState<AgendaMensual[]>([])
  const [agenda,      setAgenda]      = useState<AgendaMensual | null>(null)
  const [recurrentes, setRecurrentes] = useState<ClaseRecurrente[]>([])
  const [instancias,  setInstancias]  = useState<ClaseInstancia[]>([])
  const [profesores,  setProfesores]  = useState<Profesor[]>([])

  // Loading states
  const [loadingInit,   setLoadingInit]   = useState(true)
  const [loadingData,   setLoadingData]   = useState(false)
  const [creatingAgenda, setCreatingAgenda] = useState(false)

  // Filters
  const [filterFecha, setFilterFecha] = useState('')

  // Modals
  const [modalPatron,     setModalPatron]     = useState(false)
  const [editingPatron,   setEditingPatron]   = useState<ClaseRecurrente | null>(null)
  const [deletePatron,    setDeletePatron]    = useState<ClaseRecurrente | null>(null)
  const [modalSuelta,     setModalSuelta]     = useState(false)

  // Profesor lookup map
  const profesorMap = useMemo(
    () => new Map(profesores.map(p => [p.id, p])),
    [profesores]
  )

  // Cargar agendas + profesores al montar
  useEffect(() => {
    Promise.all([
      clasesApi.listarAgendas(),
      profesoresApi.listar(),
    ])
      .then(([agendas, profs]) => {
        setAllAgendas(agendas)
        setProfesores(profs)
      })
      .finally(() => setLoadingInit(false))
  }, [])

  // Cuando cambia el mes o las agendas → encontrar la agenda del mes
  useEffect(() => {
    if (loadingInit) return
    const mes  = currentDate.getMonth() + 1
    const anio = currentDate.getFullYear()
    const found = allAgendas.find(a => a.mes === mes && a.anio === anio) ?? null
    setAgenda(found)
    setRecurrentes([])
    setInstancias([])
  }, [currentDate, allAgendas, loadingInit])

  // Cuando hay agenda → cargar recurrentes (siempre) + instancias (solo si tab sueltas)
  useEffect(() => {
    if (!agenda) return
    setLoadingData(true)

    const promises: Promise<unknown>[] = [
      clasesApi.listarRecurrentes(agenda.id).then(setRecurrentes),
    ]
    if (tab === 'sueltas') {
      promises.push(clasesApi.listarInstancias(agenda.id).then(setInstancias))
    }

    Promise.all(promises).finally(() => setLoadingData(false))
  }, [agenda, tab])

  // Sueltas = instancias sin recurrenteId
  const sueltas = useMemo(
    () => instancias.filter(i => !i.recurrenteId),
    [instancias]
  )

  const filteredSueltas = useMemo(() => {
    if (!filterFecha) return sueltas
    return sueltas.filter(i => i.fecha.startsWith(filterFecha))
  }, [sueltas, filterFecha])

  function prevMonth() {
    setCurrentDate(d => {
      const prev = new Date(d)
      prev.setDate(1)
      prev.setMonth(prev.getMonth() - 1)
      return prev
    })
  }

  function nextMonth() {
    setCurrentDate(d => {
      const next = new Date(d)
      next.setDate(1)
      next.setMonth(next.getMonth() + 1)
      return next
    })
  }

  const mesLabel = currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  async function handleCrearAgenda() {
    setCreatingAgenda(true)
    try {
      const nueva = await clasesApi.crearAgenda(
        currentDate.getMonth() + 1,
        currentDate.getFullYear()
      )
      setAllAgendas(prev => [...prev, nueva])
      // agenda se actualizará vía el useEffect de arriba
    } finally {
      setCreatingAgenda(false)
    }
  }

  function handlePatronSaved(saved: ClaseRecurrente, isNew: boolean) {
    if (isNew) {
      setRecurrentes(prev => [...prev, saved])
    } else {
      setRecurrentes(prev => prev.map(p => p.id === saved.id ? saved : p))
    }
  }

  function handleSueltaCreated(inst: ClaseInstancia) {
    setInstancias(prev => [...prev, inst])
  }

  function handlePatronDeleted(id: number) {
    setRecurrentes(prev => prev.filter(p => p.id !== id))
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div {...fadeInUp}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">Clases</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-muted p-1 rounded-xl w-fit mb-6">
        {(['agenda', 'sueltas'] as Tab[]).map(t => (
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
            {t === 'agenda' ? 'Agenda Mensual' : 'Clases Sueltas'}
          </button>
        ))}
      </div>

      {/* Navegación de mes */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-surface-muted text-text-secondary transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-text-primary capitalize min-w-36 text-center">
          {mesLabel}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-surface-muted text-text-secondary transition-colors"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>

      {loadingInit ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {/* ── TAB: AGENDA MENSUAL ── */}
          {tab === 'agenda' && (
            <motion.div key="agenda" {...fadeInUp}>
              {!agenda ? (
                /* Sin agenda para este mes */
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <CalendarDaysIcon className="w-16 h-16 text-surface-border mb-4" />
                  <p className="text-text-primary font-medium mb-1">
                    No hay agenda para {mesLabel}
                  </p>
                  <p className="text-text-secondary text-sm mb-6">
                    Creá la agenda mensual para empezar a definir clases fijas.
                  </p>
                  {isAdmin && (
                    <Button
                      onClick={handleCrearAgenda}
                      loading={creatingAgenda}
                      icon={<PlusIcon className="w-4 h-4" />}
                      iconPosition="left"
                    >
                      Crear agenda para {mesLabel}
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Toolbar */}
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-text-secondary">
                      {recurrentes.length} clase{recurrentes.length !== 1 ? 's' : ''} fija{recurrentes.length !== 1 ? 's' : ''}
                    </p>
                    {isAdmin && (
                      <Button
                        onClick={() => { setEditingPatron(null); setModalPatron(true) }}
                        icon={<PlusIcon className="w-4 h-4" />}
                        iconPosition="left"
                        size="sm"
                      >
                        Agregar clase fija
                      </Button>
                    )}
                  </div>

                  {loadingData ? (
                    <div className="flex justify-center py-16">
                      <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : recurrentes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <CalendarDaysIcon className="w-12 h-12 text-surface-border mb-3" />
                      <p className="text-text-secondary text-sm">
                        No hay clases fijas configuradas para este mes.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-surface rounded-3xl shadow-card border border-surface-border overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-surface-border bg-surface-muted/50">
                            {['Día', 'Hora', 'Zona', 'Profesor', 'Cupo', 'Precio', ''].map(h => (
                              <th
                                key={h}
                                className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-text-secondary"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <motion.tbody
                          variants={staggerContainer}
                          initial="initial"
                          animate="animate"
                        >
                          {recurrentes.map(p => {
                            const prof = profesorMap.get(p.profesorId)
                            return (
                              <motion.tr
                                key={p.id}
                                variants={staggerItem}
                                className="border-b border-surface-border last:border-0 hover:bg-surface-muted/40 transition-colors"
                              >
                                <td className="px-4 py-3 text-sm text-text-primary font-medium">
                                  {DIAS_SEMANA[p.diaSemana]}
                                </td>
                                <td className="px-4 py-3 text-sm text-text-secondary">
                                  {p.hora}
                                </td>
                                <td className="px-4 py-3">
                                  <ZonaBadge zona={p.zona} />
                                </td>
                                <td className="px-4 py-3 text-sm text-text-secondary">
                                  {prof ? `${prof.nombre} ${prof.apellido}` : `#${p.profesorId}`}
                                </td>
                                <td className="px-4 py-3 text-sm text-text-secondary">
                                  {p.cupoMaximo} personas
                                </td>
                                <td className="px-4 py-3 text-sm text-text-secondary">
                                  {formatCurrency(p.precio)}
                                </td>
                                <td className="px-4 py-3">
                                  {isAdmin && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => { setEditingPatron(p); setModalPatron(true) }}
                                        className="p-1.5 rounded-lg text-text-secondary hover:text-brand-green-dark hover:bg-brand-green-dark/10 transition-colors"
                                      >
                                        <PencilSquareIcon className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setDeletePatron(p)}
                                        className="p-1.5 rounded-lg text-text-secondary hover:text-status-cancelada hover:bg-status-cancelada/10 transition-colors"
                                      >
                                        <TrashIcon className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </motion.tr>
                            )
                          })}
                        </motion.tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ── TAB: CLASES SUELTAS ── */}
          {tab === 'sueltas' && (
            <motion.div key="sueltas" {...fadeInUp}>
              {!agenda ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <CalendarDaysIcon className="w-16 h-16 text-surface-border mb-4" />
                  <p className="text-text-secondary text-sm">
                    No hay agenda para {mesLabel}. Creala desde la pestaña "Agenda Mensual".
                  </p>
                </div>
              ) : (
                <>
                  {/* Toolbar con filtro de fecha + botón crear */}
                  <div className="flex items-center gap-3 mb-5 flex-wrap">
                    <input
                      type="date"
                      value={filterFecha}
                      onChange={e => setFilterFecha(e.target.value)}
                      className="rounded-lg bg-surface-muted text-text-primary border border-transparent outline-none focus:border-brand-green px-3 py-2 text-sm"
                    />
                    {filterFecha && (
                      <button
                        onClick={() => setFilterFecha('')}
                        className="text-xs text-text-secondary hover:text-text-primary underline"
                      >
                        Limpiar filtro
                      </button>
                    )}
                    <div className="ml-auto">
                      {isAdmin && (
                        <Button
                          onClick={() => setModalSuelta(true)}
                          icon={<PlusIcon className="w-4 h-4" />}
                          iconPosition="left"
                          size="sm"
                        >
                          Nueva clase suelta
                        </Button>
                      )}
                    </div>
                  </div>

                  {loadingData ? (
                    <div className="flex justify-center py-16">
                      <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : filteredSueltas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <CalendarDaysIcon className="w-12 h-12 text-surface-border mb-3" />
                      <p className="text-text-secondary text-sm">
                        {filterFecha
                          ? 'No hay clases sueltas para la fecha seleccionada.'
                          : 'No hay clases sueltas para este mes.'}
                      </p>
                    </div>
                  ) : (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                      {filteredSueltas.map(inst => {
                        const fecha = new Date(inst.fecha)
                        return (
                          <motion.div
                            key={inst.id}
                            variants={staggerItem}
                            className="bg-surface rounded-3xl shadow-card border border-surface-border p-5 hover:shadow-card-hover transition-shadow"
                          >
                            {/* Fecha y hora */}
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="text-sm font-semibold text-text-primary">
                                  {fecha.toLocaleDateString('es-AR', {
                                    weekday: 'long', day: 'numeric', month: 'short'
                                  })}
                                </p>
                                <p className="text-xs text-text-secondary mt-0.5">
                                  {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                  {' · '}{inst.duracion} min
                                </p>
                              </div>
                              <ZonaBadge zona={inst.zona} />
                            </div>

                            {/* Profesor */}
                            <p className="text-xs text-text-secondary mb-3">
                              {inst.profesor
                                ? `${inst.profesor.nombre} ${inst.profesor.apellido}`
                                : '—'}
                            </p>

                            {/* Cupo + precio */}
                            <div className="flex items-center justify-between">
                              <CupoBadge activas={inst.reservasActivas} maximo={inst.cupoMaximo} />
                              <span className="text-xs font-medium text-text-secondary">
                                {formatCurrency(inst.precio)}
                              </span>
                            </div>
                          </motion.div>
                        )
                      })}
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Modales */}
      {agenda && (
        <>
          <PatronModal
            open={modalPatron}
            agendaId={agenda.id}
            patron={editingPatron}
            profesores={profesores}
            onClose={() => setModalPatron(false)}
            onSaved={handlePatronSaved}
          />
          <DeletePatronModal
            open={deletePatron !== null}
            patron={deletePatron}
            agendaId={agenda.id}
            onClose={() => setDeletePatron(null)}
            onDeleted={handlePatronDeleted}
          />
        </>
      )}

      <SueltaModal
        open={modalSuelta}
        profesores={profesores}
        onClose={() => setModalSuelta(false)}
        onCreated={handleSueltaCreated}
      />
    </motion.div>
  )
}
