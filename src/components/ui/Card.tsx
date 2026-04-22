import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  const base = 'rounded-2xl bg-slate-800 border border-slate-700 p-4'
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${base} w-full text-left active:opacity-80 transition-opacity ${className}`}
      >
        {children}
      </button>
    )
  }
  return <div className={`${base} ${className}`}>{children}</div>
}
