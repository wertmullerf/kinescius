import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { authApi } from '@/api/endpoints/auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { fadeInUp } from '@/utils/animations'

export function ResetPasswordPage() {
  const [params]   = useSearchParams()
  const navigate   = useNavigate()
  const token      = params.get('token') ?? ''

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState('')

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-white">
        <motion.div {...fadeInUp} className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-status-cancelada/10 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-8 h-8 text-status-cancelada" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Enlace inválido</h2>
          <p className="text-text-secondary text-sm mb-6">
            Este enlace de restablecimiento no es válido o expiró.
          </p>
          <Link to="/forgot-password" className="text-brand-green font-medium hover:underline text-sm">
            Solicitar un nuevo enlace
          </Link>
        </motion.div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restablecer la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-white">
      <motion.div {...fadeInUp} className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="Kinesius" className="h-20" />
        </div>

        {done ? (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center">
                <CheckCircleIcon className="w-8 h-8 text-brand-green" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">¡Contraseña cambiada!</h2>
            <p className="text-text-secondary text-sm">
              Serás redirigido al inicio de sesión en unos segundos…
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-text-primary mb-1">Nueva contraseña</h2>
            <p className="text-text-secondary text-sm mb-8">
              Elegí una contraseña nueva para tu cuenta.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="password"
                type={showPass ? 'text' : 'password'}
                label="Nueva contraseña"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                icon={<LockClosedIcon className="w-5 h-5" />}
                suffix={
                  <button type="button" onClick={() => setShowPass(s => !s)} className="cursor-pointer">
                    {showPass ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                }
                required
                autoComplete="new-password"
              />

              <Input
                id="confirm"
                type={showPass ? 'text' : 'password'}
                label="Repetir contraseña"
                placeholder="••••••••"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                icon={<LockClosedIcon className="w-5 h-5" />}
                required
                autoComplete="new-password"
              />

              {error && (
                <p className="text-sm text-status-cancelada text-center">{error}</p>
              )}

              <Button type="submit" fullWidth loading={loading}>
                Cambiar contraseña
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-text-secondary">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-brand-green font-medium hover:underline"
              >
                <ArrowLeftIcon className="w-3 h-3" />
                Volver al inicio
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  )
}
