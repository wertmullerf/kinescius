import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  ArrowTopRightOnSquareIcon,
  BanknotesIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline'
import { pagosApi } from '@/api/endpoints/pagos'
import { configApi } from '@/api/endpoints/config'
import { usuariosApi } from '@/api/endpoints/usuarios'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Toast } from '@/components/ui/Toast'
import { CardPaymentForm } from '@/components/ui/CardPaymentForm'
import { fadeInUp } from '@/utils/animations'
import { formatCurrency } from '@/utils/formatters'
import { useAuth } from '@/hooks/useAuth'
import { usePaymentStatus } from '@/hooks/usePaymentStatus'
import type { MovimientoSaldo, CardData } from '@/types'

const LABELS_MOVIMIENTO: Record<MovimientoSaldo['tipo'], string> = {
  ACREDITADO_CANCELACION_CLASE:    'Clase cancelada',
  ACREDITADO_CANCELACION_RESERVA:  'Cancelación con anticipación',
  UTILIZADO_RESERVA:               'Usado en reserva',
  REVERTIDO_RECHAZO_PAGO:         'Pago rechazado — devuelto',
  RECLAMADO:                       'Saldo reclamado',
}

const PRESETS = [3, 5, 10, 20]

const PAYMENT_TOAST: Record<string, { message: string; type: 'success' | 'error' | 'info' }> = {
  success: { message: '¡Pago confirmado! Las clases ya están acreditadas en tu cuenta.', type: 'success' },
  failure: { message: 'El pago no se procesó. Podés intentarlo de nuevo.', type: 'error' },
  pending: { message: 'Tu pago está en proceso. Te avisaremos por email cuando se acrediten las clases.', type: 'info' },
}

export function AbonosPage() {
  const { user, refreshUser } = useAuth()
  const { paymentStatus, clearPaymentStatus } = usePaymentStatus()

  const [cantidad,       setCantidad]       = useState(5)
  const [precioClase,    setPrecioClase]    = useState<number | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')
  const [initPoint,      setInitPoint]      = useState<string | null>(null)
  const [showCardModal,  setShowCardModal]  = useState(false)
  const [cardLoading,    setCardLoading]    = useState(false)
  const [cardError,      setCardError]      = useState('')
  const [cardSuccess,    setCardSuccess]    = useState(false)
  const paymentPending = useRef(false)

  // Saldo a favor
  const [saldo,           setSaldo]           = useState<number | null>(null)
  const [movimientos,     setMovimientos]     = useState<MovimientoSaldo[]>([])
  const [loadingSaldo,    setLoadingSaldo]    = useState(false)
  const [reclamando,      setReclamando]      = useState(false)
  const [montoReclamado,  setMontoReclamado]  = useState<number | null>(null)
  const [errorSaldo,      setErrorSaldo]      = useState('')

  useEffect(() => {
    configApi.obtener().then(cfg => {
      setPrecioClase(Number(cfg.precioClase))
    }).catch(() => {
      setPrecioClase(2000)
    })
  }, [])

  // Refrescar datos del usuario al montar la página
  useEffect(() => { refreshUser() }, [refreshUser])

  // Cargar saldo a favor
  useEffect(() => {
    setLoadingSaldo(true)
    usuariosApi.miSaldo()
      .then(data => { setSaldo(data.saldoFavor); setMovimientos(data.movimientos) })
      .catch(() => {})
      .finally(() => setLoadingSaldo(false))
  }, [])

  async function handleReclamar() {
    setReclamando(true)
    setErrorSaldo('')
    try {
      const { monto } = await usuariosApi.reclamarSaldo()
      setMontoReclamado(monto)
      setSaldo(0)
      setMovimientos(prev => [
        { id: Date.now(), clienteId: user!.id, monto, tipo: 'RECLAMADO', descripcion: 'Saldo reclamado por el cliente', createdAt: new Date().toISOString() },
        ...prev,
      ])
    } catch (err) {
      setErrorSaldo(err instanceof Error ? err.message : 'Error al reclamar saldo')
    } finally {
      setReclamando(false)
    }
  }

  // Cuando el usuario vuelve a la pestaña después de pagar en MP, refrescamos
  // el usuario para ver si el webhook ya acreditó las clases
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && paymentPending.current) {
        refreshUser()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refreshUser])

  const sancionado  = user?.sancionado ?? false
  const descuento   = sancionado ? 0 : 0.20
  const montoBase   = precioClase !== null ? cantidad * precioClase : 0
  const montoFinal  = Math.round(montoBase * (1 - descuento))

  async function handlePagarMp() {
    if (!precioClase || cantidad <= 0) return
    setLoading(true)
    setError('')
    setInitPoint(null)

    try {
      const resp = await pagosApi.iniciarAbonoMp({
        cantidadClases: cantidad,
        precioPorClase: precioClase,
      })
      setInitPoint(resp.initPoint)
      paymentPending.current = true
      window.open(resp.initPoint, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar el pago')
    } finally {
      setLoading(false)
    }
  }

  async function handlePagarTarjeta(cardData: CardData) {
    if (!precioClase || cantidad <= 0) return
    setCardLoading(true)
    setCardError('')
    try {
      await pagosApi.pagarAbonoTarjeta({
        cantidadClases: cantidad,
        precioPorClase: precioClase,
        tarjeta: cardData,
      })
      setCardSuccess(true)
      await refreshUser()
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Error al procesar la tarjeta')
    } finally {
      setCardLoading(false)
    }
  }

  function handleCloseCardModal() {
    setShowCardModal(false)
    setCardError('')
    if (cardSuccess) setCardSuccess(false)
  }

  return (
    <motion.div {...fadeInUp} className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Abonos</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Recargá clases y accedé al descuento de abonados.
        </p>
      </div>

      {/* Balance actual */}
      <div className="bg-surface rounded-3xl shadow-card border border-surface-border p-6 mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-green/10 flex items-center justify-center flex-shrink-0">
            <CurrencyDollarIcon className="w-7 h-7 text-brand-green" />
          </div>
          <div>
            <p className="text-xs text-text-secondary uppercase tracking-wider font-medium">
              Clases disponibles
            </p>
            <p className="text-4xl font-bold text-text-primary mt-0.5">
              {user?.clasesDisponibles ?? 0}
            </p>
            {user?.tipoCliente === 'ABONADO' && (
              <div className="flex items-center gap-1.5 mt-1">
                <CheckBadgeIcon className="w-4 h-4 text-brand-green" />
                <span className="text-xs text-brand-green font-medium">Abonado activo</span>
              </div>
            )}
          </div>
        </div>

        {sancionado && (
          <div className="mt-4 flex items-start gap-2 bg-status-cancelada/10 rounded-xl px-3 py-2.5">
            <ExclamationTriangleIcon className="w-4 h-4 text-status-cancelada flex-shrink-0 mt-0.5" />
            <p className="text-xs text-status-cancelada">
              Tu cuenta está sancionada por una cancelación tardía.
              Al recargar, la sanción se levantará automáticamente y recuperarás el descuento del 20%.
            </p>
          </div>
        )}
      </div>

      {/* Formulario de recarga */}
      <div className="bg-surface rounded-3xl shadow-card border border-surface-border p-6 space-y-5">
        <h2 className="text-sm font-semibold text-text-primary">Nueva recarga</h2>

        {/* Precio por clase (readonly, desde config) */}
        <div className="flex items-center justify-between bg-surface-muted rounded-xl px-4 py-3">
          <span className="text-sm text-text-secondary">Precio por clase</span>
          <span className="text-sm font-semibold text-text-primary">
            {precioClase !== null ? formatCurrency(precioClase) : '—'}
          </span>
        </div>

        {/* Presets de cantidad */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">Cantidad de clases</p>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map(n => (
              <button
                key={n}
                onClick={() => setCantidad(n)}
                className={[
                  'py-2.5 rounded-xl text-sm font-semibold border transition-colors',
                  cantidad === n
                    ? 'bg-brand-green text-white border-brand-green'
                    : 'border-surface-border text-text-secondary hover:border-brand-green hover:text-brand-green',
                ].join(' ')}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-secondary mt-2">Mínimo 3 clases por abono.</p>
        </div>

        {/* Resumen */}
        <div className="bg-surface-muted rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Subtotal ({cantidad} clases)</span>
            <span className="text-text-primary">{formatCurrency(montoBase)}</span>
          </div>
          {!sancionado && (
            <div className="flex justify-between text-sm">
              <span className="text-brand-green font-medium">Descuento abonado (20%)</span>
              <span className="text-brand-green font-medium">
                − {formatCurrency(montoBase * 0.20)}
              </span>
            </div>
          )}
          {sancionado && (
            <div className="flex justify-between text-sm">
              <span className="text-status-cancelada text-xs">Sin descuento (cuenta sancionada)</span>
              <span className="text-status-cancelada text-xs">−</span>
            </div>
          )}
          <div className="border-t border-surface-border pt-2 flex justify-between">
            <span className="text-sm font-semibold text-text-primary">Total a pagar</span>
            <span className="text-base font-bold text-text-primary">{formatCurrency(montoFinal)}</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-status-cancelada">{error}</p>
        )}

        {initPoint && (
          <div className="flex items-start gap-2 bg-brand-green/10 rounded-xl px-3 py-2.5">
            <CheckBadgeIcon className="w-4 h-4 text-brand-green flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-brand-green-dark">
              <p className="font-medium">Pago iniciado</p>
              <p className="mt-0.5">Si no se abrió automáticamente,{' '}
                <a
                  href={initPoint}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-semibold"
                >
                  hacé clic aquí
                </a>.
              </p>
            </div>
          </div>
        )}

        {/* Botones de pago */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => { setShowCardModal(true); setCardSuccess(false); setCardError('') }}
            disabled={precioClase === null || cantidad <= 0}
            fullWidth
            icon={<CreditCardIcon className="w-4 h-4" />}
            iconPosition="left"
          >
            Pagar con tarjeta
          </Button>
          <Button
            onClick={handlePagarMp}
            loading={loading}
            disabled={precioClase === null || cantidad <= 0}
            fullWidth
            icon={<ArrowTopRightOnSquareIcon className="w-4 h-4" />}
            iconPosition="right"
          >
            Mercado Pago
          </Button>
        </div>

        <p className="text-xs text-text-secondary text-center">
          Las clases se acreditarán automáticamente después de confirmar el pago.
        </p>
      </div>

      {/* Saldo a favor */}
      {!loadingSaldo && saldo !== null && (
        <div className="mt-5 bg-surface rounded-3xl shadow-card border border-surface-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              <BanknotesIcon className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Saldo a favor</p>
              <p className="text-xs text-text-secondary">Crédito acumulado por cancelaciones</p>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-orange-600">{formatCurrency(saldo)}</p>
              <p className="text-xs text-text-secondary mt-0.5">disponible para usar en reservas</p>
            </div>
            {saldo > 0 && (
              <Button
                onClick={handleReclamar}
                loading={reclamando}
                icon={<ArrowDownTrayIcon className="w-4 h-4" />}
                iconPosition="left"
              >
                Reclamar saldo
              </Button>
            )}
          </div>

          <AnimatePresence>
            {montoReclamado !== null && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5"
              >
                <CheckBadgeIcon className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">
                  Se procesó la devolución de <strong>{formatCurrency(montoReclamado)}</strong>.
                  El equipo del centro coordinará el reintegro.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {errorSaldo && (
            <p className="text-sm text-status-cancelada">{errorSaldo}</p>
          )}

          {/* Historial de movimientos */}
          {movimientos.length > 0 && (
            <div className="space-y-1 pt-2">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Historial</p>
              {movimientos.map(m => {
                const esCredito = m.tipo !== 'UTILIZADO_RESERVA' && m.tipo !== 'RECLAMADO'
                return (
                  <div key={m.id} className="flex items-start justify-between gap-2 py-2 border-b border-surface-border last:border-0">
                    <div className="flex items-start gap-2 min-w-0">
                      <ClockIcon className="w-3.5 h-3.5 text-text-secondary flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text-primary truncate">{LABELS_MOVIMIENTO[m.tipo]}</p>
                        <p className="text-xs text-text-secondary truncate">{m.descripcion}</p>
                        <p className="text-xs text-text-secondary">{new Date(m.createdAt).toLocaleDateString('es-AR')}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold flex-shrink-0 ${esCredito ? 'text-green-600' : 'text-status-cancelada'}`}>
                      {esCredito ? '+' : '−'}{formatCurrency(m.monto)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {paymentStatus && (
        <Toast
          message={PAYMENT_TOAST[paymentStatus].message}
          type={PAYMENT_TOAST[paymentStatus].type}
          onClose={clearPaymentStatus}
        />
      )}

      {/* Modal de pago con tarjeta */}
      <Modal
        open={showCardModal}
        onClose={handleCloseCardModal}
        title="Pagar con tarjeta"
        maxWidth="sm"
      >
        {cardSuccess ? (
          <div className="text-center space-y-4 py-2">
            <CheckBadgeIcon className="w-14 h-14 text-brand-green mx-auto" />
            <div>
              <p className="font-semibold text-text-primary text-lg">¡Pago confirmado!</p>
              <p className="text-text-secondary text-sm mt-1">
                Las clases ya están acreditadas en tu cuenta.
              </p>
            </div>
            <Button onClick={handleCloseCardModal} fullWidth>
              Cerrar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumen del monto */}
            <div className="bg-surface-muted rounded-xl px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-text-secondary">{cantidad} clases</span>
              <span className="text-base font-bold text-text-primary">{formatCurrency(montoFinal)}</span>
            </div>
            <CardPaymentForm
              onSubmit={handlePagarTarjeta}
              loading={cardLoading}
              error={cardError}
              submitLabel={`Pagar ${formatCurrency(montoFinal)}`}
            />
          </div>
        )}
      </Modal>
    </motion.div>
  )
}
