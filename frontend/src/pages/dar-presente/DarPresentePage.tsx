import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircleIcon, XCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Html5Qrcode } from 'html5-qrcode'
import { asistenciasApi } from '@/api/endpoints/asistencias'
import { fadeInUp } from '@/utils/animations'

type Estado = 'iniciando' | 'escaneando' | 'exito' | 'error'

export function DarPresentePage() {
  const navigate   = useNavigate()
  const [estado,  setEstado]  = useState<Estado>('iniciando')
  const [mensaje, setMensaje] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const elementId  = 'qr-reader'

  async function detenerScanner() {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {})
    }
  }

  async function handleSalir() {
    await detenerScanner()
    navigate(-1)
  }

  useEffect(() => {
    let scannerActivo = false
    const scanner = new Html5Qrcode(elementId)
    scannerRef.current = scanner

    // Intentar cámara trasera primero; si falla, usar cualquier cámara disponible
    const iniciar = (config: Parameters<Html5Qrcode['start']>[0]) =>
      scanner.start(
        config,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          scannerActivo = false
          await scanner.stop().catch(() => {})
          try {
            await asistenciasApi.darPresente(decodedText)
            setEstado('exito')
            setMensaje('¡Presente registrado correctamente!')
          } catch (err) {
            setEstado('error')
            setMensaje(err instanceof Error ? err.message : 'No se pudo registrar el presente')
          }
        },
        () => { /* ignore decode errors */ }
      )

    iniciar({ facingMode: 'environment' })
      .catch(() => iniciar({ facingMode: 'user' }))   // fallback para PC sin cámara trasera
      .then(() => { scannerActivo = true; setEstado('escaneando') })
      .catch((err: unknown) => {
        setEstado('error')
        setMensaje(
          err instanceof Error && err.message.toLowerCase().includes('permission')
            ? 'Necesitás permitir el acceso a la cámara para escanear el QR.'
            : 'No se pudo iniciar la cámara. Verificá que el dispositivo tenga una cámara disponible.'
        )
      })

    return () => {
      if (scannerActivo) {
        scannerActivo = false
        scanner.stop().catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function reintentar() {
    setEstado('iniciando')
    setMensaje('')
    const scanner = scannerRef.current
    if (!scanner) return
    const iniciar = (config: Parameters<Html5Qrcode['start']>[0]) =>
      scanner.start(
        config,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await scanner.stop().catch(() => {})
          try {
            await asistenciasApi.darPresente(decodedText)
            setEstado('exito')
            setMensaje('¡Presente registrado correctamente!')
          } catch (err) {
            setEstado('error')
            setMensaje(err instanceof Error ? err.message : 'No se pudo registrar el presente')
          }
        },
        () => {}
      )
    iniciar({ facingMode: 'environment' })
      .catch(() => iniciar({ facingMode: 'user' }))
      .then(() => setEstado('escaneando'))
      .catch(() => { setEstado('error'); setMensaje('No se pudo iniciar la cámara.') })
  }

  return (
    <motion.div {...fadeInUp} className="max-w-md mx-auto">
      {/* Header con botón de salida siempre visible */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleSalir}
          className="p-2 rounded-xl hover:bg-surface-muted text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Dar presente</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            Escaneá el QR de tu clase para registrar tu asistencia.
          </p>
        </div>
      </div>

      {(estado === 'exito' || estado === 'error') ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          {estado === 'exito' ? (
            <>
              <div className="w-20 h-20 rounded-full bg-brand-green/10 flex items-center justify-center">
                <CheckCircleIcon className="w-10 h-10 text-brand-green" />
              </div>
              <h2 className="text-lg font-bold text-text-primary">{mensaje}</h2>
              <button
                onClick={handleSalir}
                className="mt-2 text-sm text-brand-green font-medium hover:underline"
              >
                Volver
              </button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-status-cancelada/10 flex items-center justify-center">
                <XCircleIcon className="w-10 h-10 text-status-cancelada" />
              </div>
              <h2 className="text-lg font-bold text-text-primary">Error</h2>
              <p className="text-text-secondary text-sm max-w-xs">{mensaje}</p>
              <div className="flex gap-4 mt-2">
                <button
                  onClick={reintentar}
                  className="text-sm text-brand-green font-medium hover:underline"
                >
                  Intentar nuevamente
                </button>
                <button
                  onClick={handleSalir}
                  className="text-sm text-text-secondary font-medium hover:underline"
                >
                  Volver
                </button>
              </div>
            </>
          )}
          {/* El div del scanner siempre debe existir en el DOM para html5-qrcode */}
          <div id={elementId} className="hidden" />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {estado === 'iniciando' && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <div
            id={elementId}
            className="w-full rounded-2xl overflow-hidden border border-surface-border"
          />

          {estado === 'escaneando' && (
            <>
              <p className="text-sm text-text-secondary text-center">
                Apuntá la cámara al código QR de tu clase
              </p>
              <button
                onClick={handleSalir}
                className="text-sm text-text-secondary hover:text-text-primary font-medium hover:underline transition-colors"
              >
                Cancelar escaneo
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}
