import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  CameraIcon,
} from '@heroicons/react/24/outline'
import { profesoresApi } from '@/api/endpoints/profesores'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { fadeInUp, staggerContainer, staggerItem } from '@/utils/animations'
import type { Profesor } from '@/types'

function getInitials(nombre: string, apellido: string) {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase()
}

// ─── Form modal (crear / editar) ────────────────────────────────────────────

interface ProfesorFormProps {
  open: boolean
  profesor: Profesor | null   // null = crear
  onClose: () => void
  onSaved: (p: Profesor) => void
}

function ProfesorFormModal({ open, profesor, onClose, onSaved }: ProfesorFormProps) {
  const [form,    setForm]    = useState({ nombre: '', apellido: '', dni: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Sincronizar form cuando cambia el profesor
  useEffect(() => {
    if (open) {
      setForm(profesor
        ? { nombre: profesor.nombre, apellido: profesor.apellido, dni: profesor.dni }
        : { nombre: '', apellido: '', dni: '' }
      )
      setError('')
    }
  }, [open, profesor])

  function handleChange(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const saved = profesor
        ? await profesoresApi.editar(profesor.id, form)
        : await profesoresApi.crear(form)
      onSaved(saved)
      onClose()
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
      title={profesor ? 'Editar profesor' : 'Nuevo profesor'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="pnombre"
            label="Nombre"
            placeholder="Carlos"
            value={form.nombre}
            onChange={handleChange('nombre')}
            required
          />
          <Input
            id="papellido"
            label="Apellido"
            placeholder="López"
            value={form.apellido}
            onChange={handleChange('apellido')}
            required
          />
        </div>

        <Input
          id="pdni"
          label="DNI"
          placeholder="87654321"
          value={form.dni}
          onChange={handleChange('dni')}
          pattern="[0-9]+"
          title="Solo números"
          inputMode="numeric"
          required
        />

        {error && (
          <p className="text-sm text-status-cancelada">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} type="button" fullWidth>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} fullWidth>
            {profesor ? 'Guardar cambios' : 'Crear profesor'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Delete confirm modal ────────────────────────────────────────────────────

interface DeleteModalProps {
  open: boolean
  profesor: Profesor | null
  onClose: () => void
  onDeleted: (id: number) => void
}

function DeleteConfirmModal({ open, profesor, onClose, onDeleted }: DeleteModalProps) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (open) setError('')
  }, [open])

  async function handleDelete() {
    if (!profesor) return
    setLoading(true)
    setError('')

    try {
      await profesoresApi.eliminar(profesor.id)
      onDeleted(profesor.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Eliminar profesor" maxWidth="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-status-cancelada/10 flex items-center justify-center">
            <ExclamationTriangleIcon className="w-5 h-5 text-status-cancelada" />
          </div>
          <p className="text-sm text-text-secondary pt-2">
            ¿Eliminás a{' '}
            <span className="font-semibold text-text-primary">
              {profesor?.nombre} {profesor?.apellido}
            </span>
            ? Esta acción no se puede deshacer.
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

// ─── Page ────────────────────────────────────────────────────────────────────

export function ProfesoresPage() {
  const [profesores, setProfesores] = useState<Profesor[]>([])
  const [loading,    setLoading]    = useState(true)
  const [pageError,  setPageError]  = useState('')

  // Modal crear/editar
  const [formOpen,    setFormOpen]    = useState(false)
  const [editTarget,  setEditTarget]  = useState<Profesor | null>(null)

  // Modal eliminar
  const [deleteTarget, setDeleteTarget] = useState<Profesor | null>(null)

  // Upload de imagen
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const [uploadingId,  setUploadingId]  = useState<number | null>(null)
  const [uploadTarget, setUploadTarget] = useState<number | null>(null)

  useEffect(() => {
    profesoresApi.listar()
      .then(setProfesores)
      .catch(e => setPageError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [])

  function handleImageClick(profesorId: number) {
    setUploadTarget(profesorId)
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadTarget) return
    e.target.value = ''
    setUploadingId(uploadTarget)
    try {
      const updated = await profesoresApi.subirImagen(uploadTarget, file)
      setProfesores(prev => prev.map(p => p.id === updated.id ? updated : p))
    } catch {
      // error silencioso — podría mostrarse un toast
    } finally {
      setUploadingId(null)
      setUploadTarget(null)
    }
  }

  function openCreate() {
    setEditTarget(null)
    setFormOpen(true)
  }

  function openEdit(p: Profesor) {
    setEditTarget(p)
    setFormOpen(true)
  }

  function handleSaved(saved: Profesor) {
    setProfesores(prev => {
      const exists = prev.find(p => p.id === saved.id)
      return exists
        ? prev.map(p => p.id === saved.id ? saved : p)
        : [...prev, saved]
    })
  }

  function handleDeleted(id: number) {
    setProfesores(prev => prev.filter(p => p.id !== id))
  }

  return (
    <motion.div {...fadeInUp}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Profesores</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            Kinesiólogos del centro
          </p>
        </div>
        <Button
          onClick={openCreate}
          icon={<PlusIcon className="w-4 h-4" />}
          iconPosition="left"
        >
          Nuevo profesor
        </Button>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pageError ? (
        <p className="text-status-cancelada text-sm text-center py-20">{pageError}</p>
      ) : profesores.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <UserGroupIcon className="w-16 h-16 text-surface-border mb-4" />
          <p className="text-text-primary font-medium mb-1">Sin profesores registrados</p>
          <p className="text-text-secondary text-sm mb-6">
            Agregá el primer kinesiólogo para poder asignarlo a clases.
          </p>
          <Button onClick={openCreate} icon={<PlusIcon className="w-4 h-4" />} iconPosition="left">
            Agregar primer profesor
          </Button>
        </div>
      ) : (
        /* Tabla */
        <div className="bg-surface rounded-3xl shadow-card border border-surface-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border bg-surface-muted/50">
                <th className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  Profesor
                </th>
                <th className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  DNI
                </th>
                <th className="px-6 py-3 w-24" />
              </tr>
            </thead>
            <motion.tbody
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <AnimatePresence>
                {profesores.map(p => (
                  <motion.tr
                    key={p.id}
                    variants={staggerItem}
                    exit={{ opacity: 0, x: -20 }}
                    className="border-b border-surface-border last:border-0 hover:bg-surface-muted/40 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {/* Avatar: foto o iniciales */}
                        <div className="relative flex-shrink-0 group">
                          {p.imagenUrl ? (
                            <img
                              src={p.imagenUrl}
                              alt={`${p.nombre} ${p.apellido}`}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-brand-green-dark/10 flex items-center justify-center">
                              <span className="text-xs font-semibold text-brand-green-dark">
                                {getInitials(p.nombre, p.apellido)}
                              </span>
                            </div>
                          )}
                          {/* Overlay cámara al hacer hover */}
                          <button
                            onClick={() => handleImageClick(p.id)}
                            disabled={uploadingId === p.id}
                            className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Cambiar foto"
                          >
                            {uploadingId === p.id ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <CameraIcon className="w-4 h-4 text-white" />
                            )}
                          </button>
                        </div>
                        <span className="text-sm font-medium text-text-primary">
                          {p.nombre} {p.apellido}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {p.dni}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-brand-green-dark hover:bg-brand-green-dark/10 transition-colors"
                          title="Editar"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-status-cancelada hover:bg-status-cancelada/10 transition-colors"
                          title="Eliminar"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </motion.tbody>
          </table>
        </div>
      )}

      {/* Modales */}
      <ProfesorFormModal
        open={formOpen}
        profesor={editTarget}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <DeleteConfirmModal
        open={deleteTarget !== null}
        profesor={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />

      {/* Input oculto para seleccionar imagen */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </motion.div>
  )
}
