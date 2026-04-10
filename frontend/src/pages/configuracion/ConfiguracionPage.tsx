import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Cog6ToothIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import { configApi } from '@/api/endpoints/config'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fadeInUp } from '@/utils/animations'

export function ConfiguracionPage() {
  const [minutosClase, setMinutosClase] = useState('')
  const [precioClase,  setPrecioClase]  = useState('')
  const [loading,      setLoading]      = useState(false)
  const [fetching,     setFetching]     = useState(true)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState('')

  useEffect(() => {
    configApi.obtener()
      .then(cfg => {
        setMinutosClase(cfg.minutosClase)
        setPrecioClase(cfg.precioClase)
      })
      .finally(() => setFetching(false))
  }, [])

  async function handleGuardar() {
    const minutos = Number(minutosClase)
    const precio  = Number(precioClase)

    if (!minutos || minutos <= 0) {
      setError('Los minutos de clase deben ser un número positivo')
      return
    }
    if (!precio || precio <= 0) {
      setError('El precio por clase debe ser un número positivo')
      return
    }

    setLoading(true)
    setError('')
    setSaved(false)

    try {
      await configApi.actualizar({
        minutosClase: String(minutos),
        precioClase:  String(precio),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div {...fadeInUp} className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Configuración</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Parámetros globales del sistema. Los cambios aplican a nuevas reservas y abonos.
        </p>
      </div>

      <div className="bg-surface rounded-3xl shadow-card border border-surface-border p-6 space-y-5">
        <div className="flex items-center gap-3 pb-1">
          <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center flex-shrink-0">
            <Cog6ToothIcon className="w-5 h-5 text-brand-green" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Parámetros de clases</p>
            <p className="text-xs text-text-secondary">Afecta el precio y duración mostrados a los clientes</p>
          </div>
        </div>

        {fetching ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <Input
              id="minutos-clase"
              label="Duración de clase (minutos)"
              type="number"
              min={1}
              value={minutosClase}
              onChange={e => setMinutosClase(e.target.value)}
              icon={<ClockIcon className="w-4 h-4" />}
            />

            <Input
              id="precio-clase"
              label="Precio por clase ($)"
              type="number"
              min={1}
              value={precioClase}
              onChange={e => setPrecioClase(e.target.value)}
              icon={<CurrencyDollarIcon className="w-4 h-4" />}
            />

            {error && (
              <p className="text-sm text-status-cancelada">{error}</p>
            )}

            {saved && (
              <div className="flex items-center gap-2 bg-brand-green/10 rounded-xl px-3 py-2.5">
                <CheckCircleIcon className="w-4 h-4 text-brand-green flex-shrink-0" />
                <p className="text-xs text-brand-green font-medium">Configuración guardada correctamente</p>
              </div>
            )}

            <Button
              onClick={handleGuardar}
              loading={loading}
              fullWidth
            >
              Guardar cambios
            </Button>
          </>
        )}
      </div>

      <div className="mt-4 bg-surface-muted rounded-2xl px-4 py-3">
        <p className="text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">Nota:</span>{' '}
          Modificar estos valores no altera registros históricos. Las clases y reservas existentes
          mantienen sus precios originales.
        </p>
      </div>
    </motion.div>
  )
}
