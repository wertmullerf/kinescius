import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  message: string
  type?: ToastType
  onClose: () => void
  duration?: number
}

const icons: Record<ToastType, typeof CheckCircleIcon> = {
  success: CheckCircleIcon,
  error:   XCircleIcon,
  info:    InformationCircleIcon,
}

const colorClasses: Record<ToastType, string> = {
  success: 'text-brand-green',
  error:   'text-status-cancelada',
  info:    'text-status-paga',
}

export function Toast({ message, type = 'info', onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  const Icon = icons[type]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-surface rounded-xl shadow-modal border border-surface-border max-w-sm"
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${colorClasses[type]}`} />
        <p className="text-sm text-text-primary flex-1">{message}</p>
        <button
          onClick={onClose}
          className="p-0.5 text-text-secondary hover:text-text-primary transition-colors"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
