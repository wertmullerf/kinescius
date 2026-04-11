import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  QrCodeIcon,
  ClipboardDocumentListIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { QRCodeSVG } from 'qrcode.react'
import { asistenciasApi } from '@/api/endpoints/asistencias'
import type { AsistenciaAdmin, ClaseProfesor, AlumnoReserva } from '@/api/endpoints/asistencias'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { fadeInUp, staggerContainer, staggerItem } from '@/utils/animations'
import { formatDate, formatTime, zonaLabel } from '@/utils/formatters'

// ─── Vista Admin ──────────────────────────────────────────────────────────────

function AsistenciasAdmin() {
  const [asistencias, setAsistencias] = useState<AsistenciaAdmin[]>([])
  const [loading,     setLoading]     = useState(true)
  const [q,           setQ]           = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cargar = useCallback((query?: string) => {
    setLoading(true)
    asistenciasApi.listarTodas(query).then(setAsistencias).finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function handleSearch(val: string) {
    setQ(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => cargar(val || undefined), 400)
  }

  const presentes = asistencias.filter(a => a.presente).length
  const ausentes  = asistencias.length - presentes

  return (
    <>
      {/* Buscador */}
      <div className="relative mb-5">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
        <input
          type="text"
          placeholder="Buscar por nombre, apellido o email del cliente…"
          value={q}
          onChange={e => handleSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green"
        />
        {q && (
          <button
            onClick={() => handleSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Stats */}
      {!loading && asistencias.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-surface rounded-2xl border border-surface-border p-4 text-center">
            <p className="text-2xl font-bold text-text-primary">{asistencias.length}</p>
            <p className="text-xs text-text-secondary mt-0.5">Total</p>
          </div>
          <div className="bg-surface rounded-2xl border border-surface-border p-4 text-center">
            <p className="text-2xl font-bold text-brand-green">{presentes}</p>
            <p className="text-xs text-text-secondary mt-0.5">Presentes</p>
          </div>
          <div className="bg-surface rounded-2xl border border-surface-border p-4 text-center">
            <p className="text-2xl font-bold text-status-cancelada">{ausentes}</p>
            <p className="text-xs text-text-secondary mt-0.5">Ausentes</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : asistencias.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-16">
          {q ? 'Sin resultados para esta búsqueda.' : 'Sin asistencias registradas.'}
        </p>
      ) : (
        <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Clase</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Profesor</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Asistencia</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Registrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {asistencias.map(a => (
                  <tr key={a.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">
                        {a.reserva.cliente.apellido}, {a.reserva.cliente.nombre}
                      </p>
                      <p className="text-xs text-text-secondary">{a.reserva.cliente.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-text-primary capitalize">
                        {new Date(a.reserva.instancia.fecha).toLocaleDateString('es-AR', {
                          weekday: 'short', day: 'numeric', month: 'short',
                        })}
                        {' · '}{formatTime(a.reserva.instancia.fecha)}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Zona {zonaLabel[a.reserva.instancia.zona]}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {a.reserva.instancia.profesor.nombre} {a.reserva.instancia.profesor.apellido}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.presente ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-green">
                          <CheckCircleIcon className="w-4 h-4" />Presente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-status-cancelada">
                          <XCircleIcon className="w-4 h-4" />Ausente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {formatDate(a.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Modal QR + Lista manual (Profesor) ──────────────────────────────────────

interface ClaseModalProps {
  clase: ClaseProfesor | null
  modo: 'qr' | 'lista'
  onClose: () => void
  onAsistenciaRegistrada: (reservaId: number, presente: boolean) => void
}

function ClaseModal({ clase, modo, onClose, onAsistenciaRegistrada }: ClaseModalProps) {
  const [marcando, setMarcando] = useState<number | null>(null)
  const [errores,  setErrores]  = useState<Record<number, string>>({})

  if (!clase) return null

  const fecha = new Date(clase.fecha)
  const titulo = fecha.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  async function marcar(alumno: AlumnoReserva, presente: boolean) {
    setMarcando(alumno.id)
    setErrores(e => ({ ...e, [alumno.id]: '' }))
    try {
      await asistenciasApi.registrar(alumno.id, presente)
      onAsistenciaRegistrada(alumno.id, presente)
    } catch (err) {
      setErrores(e => ({
        ...e,
        [alumno.id]: err instanceof Error ? err.message : 'Error',
      }))
    } finally {
      setMarcando(null)
    }
  }

  const sinReservas = clase.reservas.length === 0

  return (
    <Modal
      open={!!clase}
      onClose={onClose}
      title={modo === 'qr' ? 'QR de la clase' : 'Pasar lista'}
      maxWidth="sm"
    >
      {/* Cabecera de la clase */}
      <div className="mb-4 pb-4 border-b border-surface-border">
        <p className="text-sm font-semibold text-text-primary capitalize">{titulo}</p>
        <p className="text-xs text-text-secondary mt-0.5">
          {formatTime(clase.fecha)} · Zona {zonaLabel[clase.zona]} · {clase.cupoMaximo} cupos
        </p>
      </div>

      {modo === 'qr' ? (
        /* ── Modo QR ── */
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-text-secondary text-center">
            Mostrá este código a tus pacientes para que registren su asistencia.
          </p>
          <div className="p-4 bg-white rounded-2xl border border-surface-border shadow-card">
            <QRCodeSVG value={clase.codigoQr} size={220} level="M" />
          </div>
        </div>
      ) : (
        /* ── Modo lista manual ── */
        sinReservas ? (
          <div className="flex flex-col items-center py-8 gap-2 text-center">
            <UserIcon className="w-10 h-10 text-surface-border" />
            <p className="text-sm text-text-secondary">No hay alumnos reservados para esta clase.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {clase.reservas.map(alumno => {
                const yaRegistrado = alumno.asistencia != null
                const presente = alumno.asistencia?.presente
                const cargando  = marcando === alumno.id
                const error     = errores[alumno.id]

                return (
                  <motion.div
                    key={alumno.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-surface-border bg-surface"
                  >
                    {/* Avatar / inicial */}
                    <div className="w-9 h-9 rounded-full bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-brand-green-dark">
                        {alumno.cliente.apellido.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Nombre */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {alumno.cliente.apellido}, {alumno.cliente.nombre}
                      </p>
                      {error && (
                        <p className="text-xs text-status-cancelada">{error}</p>
                      )}
                      {yaRegistrado && !error && (
                        <p className={`text-xs font-medium ${presente ? 'text-brand-green' : 'text-status-cancelada'}`}>
                          {presente ? 'Presente' : 'Ausente'} · ya registrado
                        </p>
                      )}
                    </div>

                    {/* Botones presente / ausente */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => marcar(alumno, true)}
                        disabled={cargando}
                        title="Presente"
                        className={[
                          'p-2 rounded-lg transition-colors',
                          presente === true
                            ? 'bg-brand-green/15 text-brand-green'
                            : 'text-text-secondary hover:bg-brand-green/10 hover:text-brand-green',
                          cargando ? 'opacity-50 pointer-events-none' : '',
                        ].join(' ')}
                      >
                        <CheckCircleIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => marcar(alumno, false)}
                        disabled={cargando}
                        title="Ausente"
                        className={[
                          'p-2 rounded-lg transition-colors',
                          presente === false
                            ? 'bg-status-cancelada/15 text-status-cancelada'
                            : 'text-text-secondary hover:bg-status-cancelada/10 hover:text-status-cancelada',
                          cargando ? 'opacity-50 pointer-events-none' : '',
                        ].join(' ')}
                      >
                        <XCircleIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )
      )}
    </Modal>
  )
}

// ─── Vista Profesor ───────────────────────────────────────────────────────────

function AsistenciasProfesor() {
  const [clases,   setClases]   = useState<ClaseProfesor[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState<{ clase: ClaseProfesor; modo: 'qr' | 'lista' } | null>(null)

  useEffect(() => {
    asistenciasApi.misClases().then(setClases).finally(() => setLoading(false))
  }, [])

  function handleAsistenciaRegistrada(reservaId: number, presente: boolean) {
    setClases(prev => prev.map(c => ({
      ...c,
      reservas: c.reservas.map(r =>
        r.id === reservaId
          ? { ...r, asistencia: { id: r.asistencia?.id ?? 0, presente } }
          : r
      ),
    })))
    // También actualizar el modal si está abierto
    setModal(prev => {
      if (!prev) return null
      return {
        ...prev,
        clase: {
          ...prev.clase,
          reservas: prev.clase.reservas.map(r =>
            r.id === reservaId
              ? { ...r, asistencia: { id: r.asistencia?.id ?? 0, presente } }
              : r
          ),
        },
      }
    })
  }

  const ahora = new Date()
  const hoy   = ahora.toDateString()

  const clasesHoy     = clases.filter(c => new Date(c.fecha).toDateString() === hoy)
  const clasesFuturas = clases.filter(c => new Date(c.fecha) > ahora && new Date(c.fecha).toDateString() !== hoy)
  const clasesPasadas = clases.filter(c => new Date(c.fecha) < ahora && new Date(c.fecha).toDateString() !== hoy)

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (clases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ClipboardDocumentListIcon className="w-14 h-14 text-surface-border mb-3" />
        <p className="text-text-secondary text-sm">No tenés clases asignadas en los próximos días.</p>
      </div>
    )
  }

  function ClaseCard({ clase }: { clase: ClaseProfesor }) {
    const fecha   = new Date(clase.fecha)
    const esHoy   = fecha.toDateString() === hoy
    const esPasada = fecha < ahora && !esHoy
    const confirmados = clase.reservas.length
    const registrados = clase.reservas.filter(r => r.asistencia != null).length
    const presentes   = clase.reservas.filter(r => r.asistencia?.presente === true).length

    return (
      <motion.div
        variants={staggerItem}
        className="bg-surface rounded-2xl border border-surface-border p-4"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-text-primary capitalize">
              {fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              {formatTime(clase.fecha)} · Zona {zonaLabel[clase.zona]}
            </p>
          </div>
          {esHoy && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-green/15 text-brand-green-dark">
              Hoy
            </span>
          )}
        </div>

        {/* Contador de alumnos */}
        <div className="flex items-center gap-3 mb-3 text-xs text-text-secondary">
          <span>{confirmados} reservado{confirmados !== 1 ? 's' : ''}</span>
          {esPasada && confirmados > 0 && (
            <>
              <span>·</span>
              <span className="text-brand-green font-medium">{presentes} presentes</span>
              <span>·</span>
              <span className={registrados < confirmados ? 'text-amber-600' : ''}>
                {registrados}/{confirmados} registrados
              </span>
            </>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2">
          <button
            onClick={() => setModal({ clase, modo: 'qr' })}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-surface-border text-xs font-medium text-text-secondary hover:text-brand-green-dark hover:border-brand-green/40 hover:bg-brand-green/5 transition-colors"
          >
            <QrCodeIcon className="w-4 h-4" />
            Ver QR
          </button>
          <button
            onClick={() => setModal({ clase, modo: 'lista' })}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-surface-border text-xs font-medium text-text-secondary hover:text-brand-green-dark hover:border-brand-green/40 hover:bg-brand-green/5 transition-colors"
          >
            <ClipboardDocumentListIcon className="w-4 h-4" />
            Pasar lista
          </button>
        </div>
      </motion.div>
    )
  }

  function Seccion({ titulo, items }: { titulo: string; items: ClaseProfesor[] }) {
    if (items.length === 0) return null
    return (
      <div className="mb-6">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">{titulo}</p>
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {items.map(c => <ClaseCard key={c.id} clase={c} />)}
        </motion.div>
      </div>
    )
  }

  return (
    <>
      <Seccion titulo="Hoy"      items={clasesHoy} />
      <Seccion titulo="Próximas" items={clasesFuturas} />
      <Seccion titulo="Recientes" items={clasesPasadas} />

      <ClaseModal
        clase={modal?.clase ?? null}
        modo={modal?.modo ?? 'qr'}
        onClose={() => setModal(null)}
        onAsistenciaRegistrada={handleAsistenciaRegistrada}
      />
    </>
  )
}

// ─── Page principal ────────────────────────────────────────────────────────────

export function AsistenciasPage() {
  const { user } = useAuth()
  const isProfesor = user?.rol === 'PROFESOR'

  return (
    <motion.div {...fadeInUp} className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Asistencias</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          {isProfesor
            ? 'Tus clases asignadas. Mostrá el QR o pasá lista manualmente.'
            : 'Historial de asistencias registradas.'}
        </p>
      </div>

      {isProfesor ? <AsistenciasProfesor /> : <AsistenciasAdmin />}
    </motion.div>
  )
}
