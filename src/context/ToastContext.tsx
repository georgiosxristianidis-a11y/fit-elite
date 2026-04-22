import { createContext, useState, useCallback, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'pr'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

export interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, type: ToastType, durationMs?: number) => void
}

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => undefined,
})

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType, durationMs = 3000) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [{ id, message, type }, ...prev])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, durationMs)
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast }}>
      {children}
    </ToastContext.Provider>
  )
}
