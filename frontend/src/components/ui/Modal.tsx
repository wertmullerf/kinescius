import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'
import { modalVariants } from '@/utils/animations'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg'
}

const maxWidthClass = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

export function Modal({ open, onClose, title, children, maxWidth = 'md' }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            {...modalVariants}
            className={[
              'relative w-full bg-surface rounded-xl shadow-modal',
              'border border-surface-border z-10',
              maxWidthClass[maxWidth],
            ].join(' ')}
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
                <h2 className="text-base font-semibold text-text-primary">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
