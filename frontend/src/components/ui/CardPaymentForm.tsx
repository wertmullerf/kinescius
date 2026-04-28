import { useState } from 'react'
import { CreditCardIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import type { CardData } from '@/types'
import { formatCurrency } from '@/utils/formatters'

interface PricingBreakdown {
  subtotal:    number  // monto original (ej. seña completa)
  saldoFavor: number  // descuento aplicado desde saldo
  total:       number  // lo que realmente se cobra a la tarjeta
}

interface CardPaymentFormProps {
  onSubmit: (data: CardData) => Promise<void>
  loading: boolean
  error: string
  submitLabel?: string
  pricing?: PricingBreakdown
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

export function CardPaymentForm({ onSubmit, loading, error, submitLabel = 'Pagar', pricing }: CardPaymentFormProps) {
  const [numero,          setNumero]          = useState('')
  const [cvv,             setCvv]             = useState('')
  const [fechaExpiracion, setFechaExpiracion] = useState('')
  const [titular,         setTitular]         = useState('')
  const [localError,      setLocalError]      = useState('')

  function validate(): string {
    const digits = numero.replace(/\s/g, '')
    if (digits.length < 15) return 'Número de tarjeta inválido'
    if (!/^\d{2}\/\d{2}$/.test(fechaExpiracion)) return 'Fecha de vencimiento inválida (MM/YY)'
    if (cvv.length < 3) return 'Código de seguridad inválido'
    if (titular.trim().length < 2) return 'Ingresá el nombre del titular'
    return ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setLocalError(validationError); return }
    setLocalError('')
    await onSubmit({
      numero:          numero.replace(/\s/g, ''),
      cvv,
      fechaExpiracion,
      titular:         titular.trim(),
    })
  }

  const displayError = localError || error

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <CreditCardIcon className="w-5 h-5 text-text-secondary" />
        <p className="text-sm font-semibold text-text-primary">Datos de la tarjeta</p>
      </div>

      {/* Número de tarjeta */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">
          Número de tarjeta
        </label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="0000 0000 0000 0000"
          value={numero}
          onChange={e => setNumero(formatCardNumber(e.target.value))}
          maxLength={19}
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green font-mono tracking-wider"
          autoComplete="cc-number"
        />
      </div>

      {/* Titular */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">
          Titular de la tarjeta
        </label>
        <input
          type="text"
          placeholder="Nombre como figura en la tarjeta"
          value={titular}
          onChange={e => setTitular(e.target.value.toUpperCase())}
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green uppercase"
          autoComplete="cc-name"
        />
      </div>

      {/* Vencimiento y CVV */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Vencimiento
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="MM/YY"
            value={fechaExpiracion}
            onChange={e => setFechaExpiracion(formatExpiry(e.target.value))}
            maxLength={5}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green font-mono"
            autoComplete="cc-exp"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            CVV / CVC
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="•••"
            value={cvv}
            onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength={4}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-border bg-surface text-text-primary focus:outline-none focus:border-brand-green font-mono"
            autoComplete="cc-csc"
          />
        </div>
      </div>

      {pricing && pricing.saldoFavor > 0 && (
        <div className="rounded-xl border border-surface-border bg-surface-muted px-3 py-2.5 space-y-1.5 text-xs">
          <div className="flex justify-between text-text-secondary">
            <span>Seña</span>
            <span>{formatCurrency(pricing.subtotal)}</span>
          </div>
          <div className="flex justify-between text-brand-green font-medium">
            <span>Descuento saldo a favor</span>
            <span>- {formatCurrency(pricing.saldoFavor)}</span>
          </div>
          <div className="flex justify-between text-text-primary font-semibold border-t border-surface-border pt-1.5">
            <span>Total a pagar</span>
            <span>{formatCurrency(pricing.total)}</span>
          </div>
        </div>
      )}

      {displayError && (
        <p className="text-sm text-status-cancelada bg-status-cancelada/10 rounded-xl px-3 py-2">
          {displayError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-brand-green-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <LockClosedIcon className="w-4 h-4" />
        )}
        {loading ? 'Procesando...' : submitLabel}
      </button>

      <p className="text-xs text-text-secondary text-center flex items-center justify-center gap-1">
        <LockClosedIcon className="w-3 h-3" />
        Pago seguro y encriptado
      </p>
    </form>
  )
}
