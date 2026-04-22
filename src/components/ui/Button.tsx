import { type ButtonHTMLAttributes, type ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  children: ReactNode
}

const variantClass: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-indigo-500 text-white hover:bg-indigo-400 active:bg-indigo-600',
  secondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600 active:bg-slate-800',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 active:bg-slate-700',
  danger: 'bg-red-500 text-white hover:bg-red-400 active:bg-red-600',
}

const sizeClass: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-4 py-2.5 text-sm min-h-[44px]',
  lg: 'px-6 py-3 text-base min-h-[52px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium',
        'transition-colors duration-100',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantClass[variant],
        sizeClass[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
