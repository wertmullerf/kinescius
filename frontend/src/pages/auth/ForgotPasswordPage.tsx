import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { EnvelopeIcon, ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { authApi } from '@/api/endpoints/auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { fadeInUp } from '@/utils/animations'

export function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el correo')
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

        {sent ? (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center">
                <CheckCircleIcon className="w-8 h-8 text-brand-green" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">¡Revisá tu email!</h2>
            <p className="text-text-secondary text-sm mb-6 leading-relaxed">
              Si el email <strong>{email}</strong> está registrado, recibirás un enlace
              para restablecer tu contraseña en los próximos minutos.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-brand-green font-medium hover:underline"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Volver al inicio
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-text-primary mb-1">¿Olvidaste tu contraseña?</h2>
            <p className="text-text-secondary text-sm mb-8">
              Ingresá tu email y te enviamos un enlace para restablecerla.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="email"
                type="email"
                label="Email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                icon={<EnvelopeIcon className="w-5 h-5" />}
                required
                autoComplete="email"
              />

              {error && (
                <p className="text-sm text-status-cancelada text-center">{error}</p>
              )}

              <Button type="submit" fullWidth loading={loading}>
                Enviar enlace
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
