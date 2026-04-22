import { type ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  color?: 'indigo' | 'green' | 'yellow' | 'red' | 'slate'
}

const colorClass: Record<NonNullable<BadgeProps['color']>, string> = {
  indigo: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  green: 'bg-green-500/20 text-green-300 border-green-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  red: 'bg-red-500/20 text-red-300 border-red-500/30',
  slate: 'bg-slate-700 text-slate-300 border-slate-600',
}

export function Badge({ children, color = 'slate' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass[color]}`}
    >
      {children}
    </span>
  )
}
