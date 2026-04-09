import type { ReactNode, InputHTMLAttributes } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string
  icon?: ReactNode
  error?: string
  suffix?: ReactNode
}

export function Input({ label, icon, error, suffix, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3 text-text-secondary pointer-events-none w-5 h-5 flex items-center">
            {icon}
          </span>
        )}
        <input
          id={id}
          {...props}
          className={[
            'w-full rounded-lg bg-surface-muted text-text-primary placeholder:text-text-secondary',
            'border border-transparent outline-none transition-colors',
            'focus:border-brand-green focus:bg-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            icon ? 'pl-10' : 'pl-4',
            suffix ? 'pr-10' : 'pr-4',
            'py-2.5 text-sm',
            error ? 'border-status-cancelada' : '',
          ].join(' ')}
        />
        {suffix && (
          <span className="absolute right-3 flex items-center text-text-secondary">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p className="text-xs text-status-cancelada">{error}</p>
      )}
    </div>
  )
}
