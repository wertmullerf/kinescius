import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  PlusIcon,
  BanknotesIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { pagosApi } from '@/api/endpoints/pagos'
import type { PagoAbonoConCliente, PagoConReserva } from '@/api/endpoints/pagos'
import { reservasApi } from '@/api/endpoints/reservas'
import { usuariosApi } from '@/api/endpoints/usuarios'
import type { UsuarioAdmin } from '@/api/endpoints/usuarios'
import { configApi } from '@/api/endpoints/config'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { fadeInUp } from '@/utils/animations'
import { formatCurrency, formatDate, tipoPagoLabel, metodoPagoLabel, zonaLabel } from '@/utils/formatters'
import type { MetodoPago, TipoPago, Reserva } from '@/types'

const METODOS: MetodoPago[] = ['EFECTIVO', 'TRANSFERENCIA', 'MERCADO_PAGO', 'TARJETA']

// ─── Modal: Registrar Abono Presencial ────────────────────────────────────────

function AbonoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [clientes,      setClientes]      = useState<UsuarioAdmin[]>([])
  const [precioClase,   setPrecioClase]   = useState<number | null>(null)
  const [clienteId,     setClienteId]     = useState('')
  const [cantidad,      setCantidad]      = useState(5)
  const [metodo,        setMetodo]        = useState<MetodoPago>('EFECTIVO')
  const [referencia,    setReferencia]    = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [busquedaCliente, setBusquedaCliente] = useState('')

  useEffect(() => {
    Promise.all([
      usuariosApi.listar(),
      configApi.obtener().catch(() => ({ precioClase: 2000 })),
    ]).then(([cs, cfg]) => {
      setClientes(cs)
      setPrecioClase(Number(cfg.precioClase))
    })
  }, [])

  const clientesFiltrados = clientes.filter(c => {
    const q = busquedaCliente.toLowerCase()
    return !q || `${c.nombre} ${c.apellido} ${c.dni} ${c.email}`.toLowerCase().includes(q)
  })

  const cliente = clientes.find(c => c.id === Number(clienteId))
  const montoBase  = precioClase !== null ? cantidad * precioClase : 0
  const montoFinal = cliente?.sancionado ? montoBase : Math.round(montoBase * 0.8)

  async function handleSave() {
    if (!clienteId || !cantidad || !metodo) { setError('Completá todos los campos'); return }
    if (cantidad < 3) { setError('La cantidad mínima es 3 clases'); return }
    setSaving(true)
    setError('')
    try {
      await pagosApi.registrarAbono({
        clienteId:     Number(clienteId),
        cantidadClases: cantidad,
        precioPorClase: precioClase ?? 0,
        metodo,
        referencia: referencia || undefined,
      })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Registrar abono presencial">
      <div className="space-y-4">
        {/* Buscar cliente */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Cliente</label>
          <input
            type="text"
            placeholder="Buscar por nombre, DNI o email…"
            value={busquedaCliente}
            onChange={e => { setBusquedaCliente(e.target.value); setClienteId('') }}
            className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green mb-1"
          />
          {busquedaCliente && !clienteId && (
            <div className="border border-surface-border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
              {clientesFiltrados.slice(0, 8).map(c => (
                <button
                  key={c.id}
                  onClick={() => { setClienteId(String(c.id)); setBusquedaCliente(`${c.nombre} ${c.apellido}`) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted transition-colors border-b border-surface-border last:border-0"
                >
                  <span className="font-medium text-text-primary">{c.nombre} {c.apellido}</span>
                  <span className="text-text-secondary ml-2 text-xs">{c.dni}</span>
                </button>
              ))}
              {clientesFiltrados.length === 0 && (
                <p className="px-3 py-2 text-sm text-text-secondary">Sin resultados</p>
              )}
            </div>
          )}
        </div>

        {/* Cantidad */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Cantidad de clases</label>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {[3, 5, 10, 20].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setCantidad(n)}
                className={[
                  'py-2 rounded-xl text-sm font-semibold border transition-colors',
                  cantidad === n
                    ? 'bg-brand-green text-white border-brand-green'
                    : 'border-surface-border text-text-secondary hover:border-brand-green hover:text-brand-green',
                ].join(' ')}
              >
                {n}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="3"
            value={cantidad}
            onChange={e => setCantidad(Math.max(3, Number(e.target.value)))}
            className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green"
          />
          <p className="text-xs text-text-secondary mt-1">Mínimo 3 clases por abono.</p>
        </div>

        {/* Resumen */}
        {clienteId && precioClase !== null && (
          <div className="bg-surface-muted rounded-xl p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Subtotal</span>
              <span>{formatCurrency(montoBase)}</span>
            </div>
            {!cliente?.sancionado && (
              <div className="flex justify-between text-brand-green">
                <span>Descuento 20%</span>
                <span>− {formatCurrency(montoBase * 0.2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t border-surface-border pt-1">
              <span>Total</span>
              <span>{formatCurrency(montoFinal)}</span>
            </div>
          </div>
        )}

        {/* Método */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Método de pago</label>
          <select
            value={metodo}
            onChange={e => setMetodo(e.target.value as MetodoPago)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green"
          >
            {METODOS.map(m => <option key={m} value={m}>{metodoPagoLabel[m]}</option>)}
          </select>
        </div>

        {/* Referencia */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Referencia <span className="text-text-secondary">(opcional)</span>
          </label>
          <input
            type="text"
            placeholder="Nro. de transferencia, recibo…"
            value={referencia}
            onChange={e => setReferencia(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green"
          />
        </div>

        {error && <p className="text-xs text-status-cancelada">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} fullWidth>Cancelar</Button>
          <Button onClick={handleSave} loading={saving} fullWidth>Registrar</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Tab: Abonos ──────────────────────────────────────────────────────────────

function AbonossTab() {
  const [abonos,    setAbonos]    = useState<PagoAbonoConCliente[]>([])
  const [loading,   setLoading]   = useState(true)
  const [q,         setQ]         = useState('')
  const [showModal, setShowModal] = useState(false)
  const [toastOk,   setToastOk]   = useState(false)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cargar = useCallback((query?: string) => {
    setLoading(true)
    pagosApi.listarAbonos(query).then(setAbonos).finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function handleSearch(val: string) {
    setQ(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => cargar(val || undefined), 400)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="Buscar por cliente…"
            value={q}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green"
          />
          {q && (
            <button onClick={() => handleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary">
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button icon={<PlusIcon className="w-4 h-4" />} onClick={() => setShowModal(true)}>
          Registrar abono
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : abonos.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-10">Sin abonos{q ? ' para esta búsqueda' : ''}.</p>
      ) : (
        <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Cliente</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Clases</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Monto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Método</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {abonos.map(a => (
                  <tr key={a.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{a.cliente.apellido}, {a.cliente.nombre}</p>
                      <p className="text-xs text-text-secondary">{a.cliente.email}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-brand-green">{a.cantidadClases}</td>
                    <td className="px-4 py-3 text-right font-semibold text-text-primary">{formatCurrency(a.monto)}</td>
                    <td className="px-4 py-3 text-text-secondary">{metodoPagoLabel[a.metodo]}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <AbonoModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); cargar(q || undefined); setToastOk(true) }}
        />
      )}

      {toastOk && (
        <Toast
          message="Abono registrado correctamente."
          type="success"
          onClose={() => setToastOk(false)}
        />
      )}
    </div>
  )
}

// ─── Tab: Pagos de Reservas ───────────────────────────────────────────────────

function HistorialTab() {
  const [pagos,   setPagos]   = useState<PagoConReserva[]>([])
  const [loading, setLoading] = useState(true)
  const [q,       setQ]       = useState('')
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cargar = useCallback((query?: string) => {
    setLoading(true)
    pagosApi.listarHistorial(query).then(setPagos).finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function handleSearch(val: string) {
    setQ(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => cargar(val || undefined), 400)
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
        <input
          type="text"
          placeholder="Buscar por cliente…"
          value={q}
          onChange={e => handleSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green"
        />
        {q && (
          <button onClick={() => handleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary">
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pagos.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-10">Sin pagos{q ? ' para esta búsqueda' : ''}.</p>
      ) : (
        <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Clase</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Monto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Método</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {pagos.map(p => (
                  <tr key={p.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">
                        {p.reserva.cliente.apellido}, {p.reserva.cliente.nombre}
                      </p>
                      <p className="text-xs text-text-secondary">{p.reserva.cliente.email}</p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(p.reserva.instancia.fecha).toLocaleDateString('es-AR', {
                        day: 'numeric', month: 'short',
                      })}
                      {' · '}Zona {zonaLabel[p.reserva.instancia.zona]}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-text-primary">
                        {tipoPagoLabel[p.tipo as TipoPago]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text-primary">
                      {formatCurrency(p.monto)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{metodoPagoLabel[p.metodo]}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Completar pagos ─────────────────────────────────────────────────────

function ComplementarTab() {
  const [todasReservas, setTodasReservas] = useState<Reserva[]>([])
  const [loading,       setLoading]       = useState(true)
  const [busqueda,      setBusqueda]      = useState('')

  // Modal de complemento
  const [reservaTarget, setReservaTarget] = useState<Reserva | null>(null)
  const [metodo,        setMetodo]        = useState<MetodoPago>('EFECTIVO')
  const [referencia,    setReferencia]    = useState('')
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState('')
  const [saveOk,        setSaveOk]        = useState(false)

  useEffect(() => {
    setLoading(true)
    reservasApi.listar()
      .then(rs => setTodasReservas(rs.filter(r => r.estado === 'RESERVA_PAGA')))
      .finally(() => setLoading(false))
  }, [])

  const reservasFiltradas = todasReservas.filter(r => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    const c = r.cliente
    return c
      ? `${c.nombre} ${c.apellido} ${(c as any).dni ?? ''} ${c.email}`.toLowerCase().includes(q)
      : false
  })

  async function handleComplementar() {
    if (!reservaTarget) return
    setSaving(true)
    setSaveError('')
    try {
      await pagosApi.registrarComplemento(reservaTarget.id, { metodo, referencia: referencia || undefined })
      setSaveOk(true)
      setTodasReservas(prev => prev.filter(r => r.id !== reservaTarget.id))
      setTimeout(() => { setReservaTarget(null); setSaveOk(false); setReferencia('') }, 1200)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al registrar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Buscador (filtro client-side) */}
      <div className="relative">
        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
        <input
          type="text"
          placeholder="Filtrar por nombre o DNI del cliente…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green"
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Lista de reservas pendientes */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reservasFiltradas.length === 0 ? (
        <div className="bg-surface-muted rounded-2xl p-5 text-center text-sm text-text-secondary">
          {busqueda ? 'Sin resultados para esta búsqueda.' : 'No hay reservas pendientes de complemento.'}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {reservasFiltradas.length} reserva{reservasFiltradas.length !== 1 ? 's' : ''} pendiente{reservasFiltradas.length !== 1 ? 's' : ''} de complemento
          </p>
          {reservasFiltradas.map(r => {
            const inst = r.instancia
            const montoTotal    = inst ? Number(inst.precio) : 0
            const montoPagado   = Number(r.montoPagado)
            const montoFaltante = montoTotal - montoPagado
            return (
              <div key={r.id} className="bg-surface rounded-2xl border border-surface-border p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {r.cliente && (
                    <p className="text-sm font-semibold text-text-primary">
                      {r.cliente.apellido}, {r.cliente.nombre}
                    </p>
                  )}
                  {inst ? (
                    <p className="text-xs text-text-secondary mt-0.5 capitalize">
                      {new Date(inst.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      {' · '}Zona {zonaLabel[inst.zona]}
                      {' · '}Seña: {formatCurrency(montoPagado)}
                      {' · '}<span className="text-status-pendiente font-medium">Falta: {formatCurrency(montoFaltante)}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-text-secondary">Reserva #{r.id}</p>
                  )}
                </div>
                <Button
                  icon={<BanknotesIcon className="w-4 h-4" />}
                  onClick={() => { setReservaTarget(r); setMetodo('EFECTIVO'); setReferencia(''); setSaveError(''); setSaveOk(false) }}
                  size="sm"
                >
                  Registrar cobro
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de complemento */}
      <Modal open={!!reservaTarget} onClose={() => setReservaTarget(null)} title="Registrar cobro del complemento">
        {reservaTarget && (
          <div className="space-y-4">
            {reservaTarget.cliente && (
              <p className="text-sm font-medium text-text-primary">
                {reservaTarget.cliente.apellido}, {reservaTarget.cliente.nombre}
              </p>
            )}
            {reservaTarget.instancia && (
              <div className="bg-surface-muted rounded-xl p-3 text-sm">
                <p className="font-medium text-text-primary capitalize">
                  {new Date(reservaTarget.instancia.fecha).toLocaleDateString('es-AR', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </p>
                <p className="text-text-secondary mt-0.5">
                  Monto a cobrar:{' '}
                  <span className="font-semibold text-text-primary">
                    {formatCurrency(Number(reservaTarget.instancia.precio) - Number(reservaTarget.montoPagado))}
                  </span>
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Método de pago</label>
              <select
                value={metodo}
                onChange={e => setMetodo(e.target.value as MetodoPago)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green"
              >
                {METODOS.map(m => <option key={m} value={m}>{metodoPagoLabel[m]}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Referencia <span className="text-text-secondary font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Nro. de recibo, transferencia…"
                value={referencia}
                onChange={e => setReferencia(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green"
              />
            </div>

            {saveError && <p className="text-xs text-status-cancelada">{saveError}</p>}
            {saveOk    && <p className="text-xs text-brand-green font-medium">¡Complemento registrado!</p>}

            <div className="flex gap-2 pt-1">
              <Button variant="ghost" onClick={() => setReservaTarget(null)} fullWidth>Cancelar</Button>
              <Button onClick={handleComplementar} loading={saving} disabled={saveOk} fullWidth>
                Confirmar cobro
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'abonos' | 'historial' | 'complementar'

const TAB_LABELS: Record<Tab, string> = {
  abonos:       'Abonos',
  historial:    'Pagos de reservas',
  complementar: 'Completar pagos',
}

export function PagosPage() {
  const [tab, setTab] = useState<Tab>('abonos')

  return (
    <motion.div {...fadeInUp} className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Pagos</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Abonos, pagos de reservas y cobro de complementos.
        </p>
      </div>

      <div className="flex gap-1 bg-surface-muted p-1 rounded-xl w-fit mb-6">
        {(['abonos', 'historial', 'complementar'] as Tab[]).map(t => (
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
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'abonos'       && <AbonossTab />}
      {tab === 'historial'    && <HistorialTab />}
      {tab === 'complementar' && <ComplementarTab />}
    </motion.div>
  )
}
