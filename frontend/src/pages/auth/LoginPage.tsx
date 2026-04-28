import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { fadeInUp, shakeVariants } from '@/utils/animations'

export function LoginPage() {
  const { login, verify2FA } = useAuth()
  const navigate = useNavigate()

  // Paso 1: credenciales
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  // Paso 2: código 2FA
  const [step,     setStep]     = useState<'credentials' | '2fa'>('credentials')
  const [userId,   setUserId]   = useState<number | null>(null)
  const [codigo,   setCodigo]   = useState('')

  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [shakeKey, setShakeKey] = useState(0)

  function shake() {
    setShakeKey(k => k + 1)
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await login(email, password)
      if (result.type === '2fa_required') {
        setUserId(result.userId)
        setStep('2fa')
      } else {
        const { user } = result
        if (user.rol === 'ADMIN')         navigate('/dashboard',   { replace: true })
        else if (user.rol === 'PROFESOR') navigate('/asistencias', { replace: true })
        else                              navigate('/reservas',     { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
      shake()
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify2FA(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setError('')
    setLoading(true)

    try {
      await verify2FA(userId, codigo)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código incorrecto')
      setCodigo('')
      shake()
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

          {step === 'credentials' ? (
            <>
              <h2 className="text-2xl font-bold text-text-primary mb-1">Bienvenido</h2>
              <p className="text-text-secondary text-sm mb-8">Ingresá con tu cuenta para continuar</p>

              <form onSubmit={handleCredentials} className="space-y-4">
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

              <div className="mt-4 text-center">
                <Link to="/forgot-password" className="text-sm text-text-secondary hover:text-brand-green transition-colors">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <p className="mt-4 text-center text-sm text-text-secondary">
                ¿No tenés cuenta?{' '}
                <Link to="/register" className="text-brand-green font-medium hover:underline">
                  Registrate
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-brand-green/10 flex items-center justify-center">
                  <ShieldCheckIcon className="w-7 h-7 text-brand-green" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-1 text-center">Verificación</h2>
              <p className="text-text-secondary text-sm mb-8 text-center">
                Enviamos un código de 6 dígitos a tu correo. Ingresalo para continuar.
              </p>

              <form onSubmit={handleVerify2FA} className="space-y-4">
                <Input
                  id="codigo"
                  type="text"
                  label="Código de verificación"
                  placeholder="123456"
                  value={codigo}
                  onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  icon={<ShieldCheckIcon className="w-5 h-5" />}
                  required
                  autoComplete="one-time-code"
                  inputMode="numeric"
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
                  disabled={codigo.length !== 6}
                  icon={<ArrowRightIcon className="w-4 h-4" />}
                  iconPosition="right"
                >
                  Verificar
                </Button>
              </form>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); setCodigo('') }}
                className="mt-4 w-full text-center text-sm text-text-secondary hover:text-brand-green transition-colors"
              >
                ← Volver al inicio de sesión
              </button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
