import { useContext } from 'react'
import { ToastContext, type Toast } from '@/context/ToastContext'

const toastStyles: Record<Toast['type'], string> = {
  success: 'bg-green-500 text-white',
  error: 'bg-red-500 text-white',
  pr: 'bg-yellow-400 text-slate-900',
}

export function ToastList() {
  const { toasts } = useContext(ToastContext)

  // Show at most 3 newest toasts (newest is first in the array)
  const visible = toasts.slice(0, 3)

  if (visible.length === 0) return null

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 0.5rem)' }}
      aria-live="polite"
      aria-label="Notifications"
    >
      {visible.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={[
            'rounded-2xl px-4 py-3 text-sm font-medium shadow-lg max-w-[320px] text-center',
            toastStyles[toast.type],
          ].join(' ')}
        >
          {toast.type === 'pr' ? `🏆 ${toast.message}` : toast.message}
        </div>
      ))}
    </div>
  )
}
