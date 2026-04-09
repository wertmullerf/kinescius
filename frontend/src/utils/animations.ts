// Tipamos `ease` con `as const` para satisfacer el type `Easing` de framer-motion

export const fadeInUp = {
  initial:    { opacity: 0, y: 20 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: 'easeOut' as const },
}

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
}

export const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
}

export const modalVariants = {
  initial:    { opacity: 0, scale: 0.95 },
  animate:    { opacity: 1, scale: 1 },
  exit:       { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
}

export const shakeVariants = {
  initial:    { x: 0 },
  animate:    { x: [0, -8, 8, -8, 8, 0] as number[] },
  transition: { duration: 0.4 },
}
