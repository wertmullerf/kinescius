import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  UserIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { usuariosApi } from '@/api/endpoints/usuarios'
import type { UsuarioAdmin } from '@/api/endpoints/usuarios'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { fadeInUp } from '@/utils/animations'
import { formatDate, estadoLabel, zonaLabel } from '@/utils/formatters'
import { COLORS } from '@/constants/colors'
import type { TipoCliente, EstadoReserva } from '@/types'

const ESTADO_COLOR: Record<EstadoReserva, string> = {
  PENDIENTE_PAGO: COLORS.status.PENDIENTE_PAGO,
  RESERVA_PAGA:   COLORS.status.RESERVA_PAGA,
  CONFIRMADA:     COLORS.status.CONFIRMADA,
  CANCELADA:      COLORS.status.CANCELADA,
  COMPLETADA:     COLORS.status.COMPLETADA,
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  usuario: UsuarioAdmin
  onClose: () => void
  onSaved: (u: UsuarioAdmin) => void
}

function EditModal({ usuario, onClose, onSaved }: EditModalProps) {
  const [form,    setForm]    = useState({
    nombre:   usuario.nombre,
    apellido: usuario.apellido,
    dni:      usuario.dni,
    email:    usuario.email,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const updated = await usuariosApi.editar(usuario.id, form)
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar cliente">
      <div className="space-y-4">
        {(['nombre', 'apellido', 'dni', 'email'] as const).map(field => (
          <div key={field}>
            <label className="block text-xs font-medium text-text-secondary mb-1 capitalize">
              {field}
            </label>
            <input
              type={field === 'email' ? 'email' : 'text'}
              value={form[field]}
              onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-sm text-text-primary focus:outline-none focus:border-brand-green"
            />
          </div>
        ))}
        {error && <p className="text-xs text-status-cancelada">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} fullWidth>Cancelar</Button>
          <Button onClick={handleSave} loading={saving} fullWidth>Guardar</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ usuario, onClose }: { usuario: UsuarioAdmin; onClose: () => void }) {
  const [detalle, setDetalle] = useState<UsuarioAdmin | null>(null)

  useEffect(() => {
    usuariosApi.obtener(usuario.id).then(setDetalle)
  }, [usuario.id])

  return (
    <Modal open onClose={onClose} title={`${usuario.nombre} ${usuario.apellido}`} maxWidth="lg">
      <div className="space-y-4">
        {/* Info básica */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-surface-muted rounded-xl p-3">
            <p className="text-xs text-text-secondary mb-0.5">DNI</p>
            <p className="font-medium text-text-primary">{usuario.dni}</p>
          </div>
          <div className="bg-surface-muted rounded-xl p-3">
            <p className="text-xs text-text-secondary mb-0.5">Email</p>
            <p className="font-medium text-text-primary truncate">{usuario.email}</p>
          </div>
          <div className="bg-surface-muted rounded-xl p-3">
            <p className="text-xs text-text-secondary mb-0.5">Tipo</p>
            <p className="font-medium text-text-primary">{usuario.tipoCliente}</p>
          </div>
          <div className="bg-surface-muted rounded-xl p-3">
            <p className="text-xs text-text-secondary mb-0.5">Clases disponibles</p>
            <p className="font-bold text-brand-green text-lg">
              {detalle ? detalle.clasesDisponibles : usuario.clasesDisponibles}
            </p>
          </div>
        </div>

        {/* Historial de reservas */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
            Últimas reservas
          </h3>
          {!detalle ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !detalle.reservas?.length ? (
            <p className="text-sm text-text-secondary text-center py-4">Sin reservas.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {detalle.reservas.map(r => {
                const color = ESTADO_COLOR[r.estado]
                return (
                  <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-surface-muted">
                    <div>
                      {r.instancia ? (
                        <p className="text-xs font-medium text-text-primary">
                          {new Date(r.instancia.fecha).toLocaleDateString('es-AR', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                          {' · '}Zona {r.instancia.zona}
                        </p>
                      ) : (
                        <p className="text-xs text-text-secondary">Reserva #{r.id}</p>
                      )}
                    </div>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full border"
                      style={{ color, backgroundColor: `${color}18`, borderColor: `${color}35` }}
                    >
                      {estadoLabel[r.estado]}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-text-secondary text-right">
          Cliente desde {formatDate(usuario.createdAt)}
        </p>
      </div>
    </Modal>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FiltroTipo = 'todos' | TipoCliente
type FiltroSancion = 'todos' | 'si' | 'no'

export function UsuariosPage() {
  const [usuarios,        setUsuarios]        = useState<UsuarioAdmin[]>([])
  const [loading,         setLoading]         = useState(true)
  const [busqueda,        setBusqueda]        = useState('')
  const [filtroTipo,      setFiltroTipo]      = useState<FiltroTipo>('todos')
  const [filtroSancion,   setFiltroSancion]   = useState<FiltroSancion>('todos')
  const [detailTarget,    setDetailTarget]    = useState<UsuarioAdmin | null>(null)
  const [editTarget,      setEditTarget]      = useState<UsuarioAdmin | null>(null)
  const [deleteTarget,    setDeleteTarget]    = useState<UsuarioAdmin | null>(null)
  const [deleting,        setDeleting]        = useState(false)
  const [liftingId,       setLiftingId]       = useState<number | null>(null)
  const [actionError,     setActionError]     = useState('')

  const cargar = useCallback(() => {
    setLoading(true)
    usuariosApi.listar({
      busqueda:    busqueda || undefined,
      tipoCliente: filtroTipo !== 'todos' ? filtroTipo : undefined,
      sancionado:  filtroSancion === 'si' ? true : filtroSancion === 'no' ? false : undefined,
    }).then(setUsuarios).finally(() => setLoading(false))
  }, [busqueda, filtroTipo, filtroSancion])

  useEffect(() => { cargar() }, [cargar])

  async function handleLevantarSancion(u: UsuarioAdmin) {
    setLiftingId(u.id)
    setActionError('')
    try {
      const updated = await usuariosApi.editar(u.id, { sancionado: false })
      setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, ...updated } : x))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLiftingId(null)
    }
  }

  async function handleEliminar() {
    if (!deleteTarget) return
    setDeleting(true)
    setActionError('')
    try {
      await usuariosApi.eliminar(deleteTarget.id)
      setUsuarios(prev => prev.filter(u => u.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <motion.div {...fadeInUp} className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Usuarios</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Gestión de clientes.
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-surface rounded-2xl border border-surface-border p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="Buscar por nombre, apellido, DNI o email…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value as FiltroTipo)}
          className="px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green"
        >
          <option value="todos">Todos los tipos</option>
          <option value="ABONADO">Abonados</option>
          <option value="NO_ABONADO">No abonados</option>
        </select>

        <select
          value={filtroSancion}
          onChange={e => setFiltroSancion(e.target.value as FiltroSancion)}
          className="px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green"
        >
          <option value="todos">Todas las cuentas</option>
          <option value="si">Sancionados</option>
          <option value="no">Sin sanción</option>
        </select>
      </div>

      {actionError && (
        <p className="text-sm text-status-cancelada mb-3">{actionError}</p>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : usuarios.length === 0 ? (
        <div className="text-center py-16 text-text-secondary text-sm">
          No se encontraron usuarios.
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">DNI</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Tipo</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Clases</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetailTarget(u)}
                        className="text-left hover:text-brand-green transition-colors"
                      >
                        <p className="font-medium text-text-primary">{u.apellido}, {u.nombre}</p>
                        <p className="text-xs text-text-secondary">{u.email}</p>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{u.dni}</td>
                    <td className="px-4 py-3">
                      {u.tipoCliente === 'ABONADO' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-green">
                          <CheckBadgeIcon className="w-3.5 h-3.5" />
                          Abonado
                        </span>
                      ) : (
                        <span className="text-xs text-text-secondary">No abonado</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-text-primary">
                      {u.clasesDisponibles}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.sancionado ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-status-cancelada">
                          <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                          Sancionado
                        </span>
                      ) : (
                        <span className="text-xs text-brand-green font-medium">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {u.sancionado && (
                          <button
                            onClick={() => handleLevantarSancion(u)}
                            disabled={liftingId === u.id}
                            className="px-2 py-1 text-xs font-medium text-status-cancelada border border-status-cancelada/30 rounded-lg hover:bg-status-cancelada/10 transition-colors disabled:opacity-50"
                          >
                            {liftingId === u.id ? '...' : 'Levantar'}
                          </button>
                        )}
                        <button
                          onClick={() => setEditTarget(u)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setDeleteTarget(u); setActionError('') }}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-status-cancelada hover:bg-status-cancelada/10 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Total */}
      {!loading && usuarios.length > 0 && (
        <p className="text-xs text-text-secondary mt-3 text-right">
          {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Modales */}
      {detailTarget && (
        <DetailModal
          usuario={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {editTarget && (
        <EditModal
          usuario={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={updated => {
            setUsuarios(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u))
            setEditTarget(null)
          }}
        />
      )}

      {/* Confirm delete */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar cliente"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            ¿Estás seguro de eliminar a{' '}
            <strong className="text-text-primary">
              {deleteTarget?.nombre} {deleteTarget?.apellido}
            </strong>
            ? Esta acción no se puede deshacer.
          </p>
          {actionError && <p className="text-xs text-status-cancelada">{actionError}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} fullWidth>Cancelar</Button>
            <button
              onClick={handleEliminar}
              disabled={deleting}
              className="flex-1 py-2 rounded-xl bg-status-cancelada text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
