import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { asistenciasApi } from '@/api/endpoints/asistencias'
import type { AsistenciaAdmin } from '@/api/endpoints/asistencias'
import { fadeInUp } from '@/utils/animations'
import { formatDate, formatTime, zonaLabel } from '@/utils/formatters'

export function AsistenciasPage() {
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
    <motion.div {...fadeInUp} className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Asistencias</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Historial de asistencias registradas.
        </p>
      </div>

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

      {/* Stats rápidas */}
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

      {/* Lista */}
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
                          <CheckCircleIcon className="w-4 h-4" />
                          Presente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-status-cancelada">
                          <XCircleIcon className="w-4 h-4" />
                          Ausente
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
    </motion.div>
  )
}
