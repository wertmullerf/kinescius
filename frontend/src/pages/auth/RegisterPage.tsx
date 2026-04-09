import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  UserIcon,
  IdentificationIcon,
  EnvelopeIcon,
  LockClosedIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { authApi } from '@/api/endpoints/auth'
import { useAuth } from '@/hooks/useAuth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { fadeInUp, shakeVariants } from '@/utils/animations'

export function RegisterPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    nombre:   '',
    apellido: '',
    dni:      '',
    email:    '',
    password: '',
  })
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [shakeKey, setShakeKey] = useState(0)

  function handleChange(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await authApi.register(form)
      // Login automático con las mismas credenciales
      await login(form.email, form.password)
      navigate('/reservas', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse')
      setShakeKey(k => k + 1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Columna izquierda — imagen (solo desktop) */}
      <div
        className="hidden lg:flex lg:w-1/2 relative bg-brand-green-dark items-end"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-brand-green-dark/90 via-brand-green-dark/40 to-transparent" />
        <div className="relative px-10 pb-12 text-white">
          <h1 className="text-3xl font-bold mb-3 leading-snug">
            Comenzá tu camino
          </h1>
          <p className="text-white/70 text-base leading-relaxed">
            Unite a Kinesius y accedé a clases de kinesiología con profesionales que cuidan cada detalle de tu recuperación.
          </p>
        </div>
      </div>

      {/* Columna derecha — formulario */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <motion.div
          {...fadeInUp}
          className="w-full max-w-sm"
        >
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src="/logo.png" alt="Kinesius" className="h-20" />
          </div>

          <h2 className="text-2xl font-bold text-text-primary mb-1">Crear cuenta</h2>
          <p className="text-text-secondary text-sm mb-8">Completá tus datos para registrarte</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nombre y Apellido en grid 2 cols */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="nombre"
                type="text"
                label="Nombre"
                placeholder="Juan"
                value={form.nombre}
                onChange={handleChange('nombre')}
                icon={<UserIcon className="w-5 h-5" />}
                required
              />
              <Input
                id="apellido"
                type="text"
                label="Apellido"
                placeholder="Pérez"
                value={form.apellido}
                onChange={handleChange('apellido')}
                required
              />
            </div>

            <Input
              id="dni"
              type="text"
              label="DNI"
              placeholder="12345678"
              value={form.dni}
              onChange={handleChange('dni')}
              icon={<IdentificationIcon className="w-5 h-5" />}
              required
              inputMode="numeric"
            />

            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="tu@email.com"
              value={form.email}
              onChange={handleChange('email')}
              icon={<EnvelopeIcon className="w-5 h-5" />}
              required
              autoComplete="email"
            />

            <Input
              id="password"
              type="password"
              label="Contraseña"
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={handleChange('password')}
              icon={<LockClosedIcon className="w-5 h-5" />}
              required
              autoComplete="new-password"
              minLength={6}
            />

            {/* Mensaje de error animado */}
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
              Crear cuenta
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="text-brand-green font-medium hover:underline">
              Ingresá
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
