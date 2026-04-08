import { type ReactNode } from 'react'

interface TopBarProps {
  title: string
  right?: ReactNode
}

export function TopBar({ title, right }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-10">
      <h1 className="text-lg font-bold text-slate-100">{title}</h1>
      {right && <div>{right}</div>}
    </header>
  )
}
