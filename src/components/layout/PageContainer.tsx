import { type ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  className?: string
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <main className={`flex-1 overflow-y-auto pb-20 ${className}`}>
      {children}
    </main>
  )
}
