import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export type PaymentStatus = 'success' | 'failure' | 'pending'

const VALID: PaymentStatus[] = ['success', 'failure', 'pending']

// MP también agrega estos params en el redirect — los limpiamos todos
const MP_PARAMS = [
  'payment', 'payment_id', 'status', 'collection_status',
  'merchant_order_id', 'preference_id', 'external_reference',
  'collection_id', 'payment_type',
]

/**
 * Lee el query param `?payment=success|failure|pending` que Mercado Pago
 * agrega al redirigir al back_url. Lo consume una sola vez, limpia la URL
 * y devuelve el estado para que el componente muestre un toast.
 */
export function usePaymentStatus() {
  const location = useLocation()
  const navigate  = useNavigate()
  const [status, setStatus] = useState<PaymentStatus | null>(null)

  useEffect(() => {
    const params  = new URLSearchParams(location.search)
    const payment = params.get('payment')

    if (payment && VALID.includes(payment as PaymentStatus)) {
      setStatus(payment as PaymentStatus)

      // Limpiar todos los params de MP de la URL
      MP_PARAMS.forEach(p => params.delete(p))
      navigate(
        { search: params.toString() ? `?${params.toString()}` : '' },
        { replace: true }
      )
    }
  // Solo en el mount — no queremos que se re-ejecute si navigate cambia
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    paymentStatus:      status,
    clearPaymentStatus: () => setStatus(null),
  }
}
