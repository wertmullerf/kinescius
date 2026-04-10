import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { fadeInUp, shakeVariants } from '@/utils/animations'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [shakeKey, setShakeKey] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // login() devuelve el user directo del response — no esperamos re-render
      const loggedUser = await login(email, password)
      if (loggedUser.rol === 'ADMIN')         navigate('/dashboard',   { replace: true })
      else if (loggedUser.rol === 'PROFESOR') navigate('/asistencias', { replace: true })
      else                                    navigate('/reservas',     { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
      setShakeKey(k => k + 1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Columna izquierda — imagen inspiracional (solo desktop) */}
      <div
        className="hidden lg:flex lg:w-1/2 relative bg-brand-green-dark items-end"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-brand-green-dark/90 via-brand-green-dark/40 to-transparent" />
        <div className="relative px-10 pb-12 text-white">
          <h1 className="text-3xl font-bold mb-3 leading-snug">
            Tu salud, nuestra prioridad
          </h1>
          <p className="text-white/70 text-base leading-relaxed">
            Gestioná tus clases, reservas y seguimiento kinesiológico en un solo lugar.
          </p>
        </div>
      </div>

      {/* Columna derecha — formulario */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <motion.div {...fadeInUp} className="w-full max-w-sm">
          <div className="flex justify-center mb-8">
            <img src="/logo.png" alt="Kinesius" className="h-20" />
          </div>

          <h2 className="text-2xl font-bold text-text-primary mb-1">Bienvenido</h2>
          <p className="text-text-secondary text-sm mb-8">Ingresá con tu cuenta para continuar</p>

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

            <Input
              id="password"
              type={showPass ? 'text' : 'password'}
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              icon={<LockClosedIcon className="w-5 h-5" />}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="cursor-pointer"
                >
                  {showPass
                    ? <EyeSlashIcon className="w-5 h-5" />
                    : <EyeIcon className="w-5 h-5" />}
                </button>
              }
              required
              autoComplete="current-password"
            />

            {error && (
              <motion.p
                key={shakeKey}
                initial="initial"
                animate="animate"
                variants={shakeVariants}
                transition={shakeVariants.transition}
                className="text-sm text-status-cancelada text-center"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              fullWidth
              loading={loading}
              icon={<ArrowRightIcon className="w-4 h-4" />}
              iconPosition="right"
            >
              Ingresar
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            ¿No tenés cuenta?{' '}
            <Link to="/register" className="text-brand-green font-medium hover:underline">
              Registrate
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
