import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className = '', hover = false, onClick }: CardProps) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hover ? { y: -2 } : undefined}
      className={[
        'bg-surface rounded-xl shadow-card border border-surface-border',
        hover ? 'hover:shadow-card-hover transition-shadow cursor-pointer' : '',
        className,
      ].join(' ')}
    >
      {children}
    </motion.div>
  )
}
