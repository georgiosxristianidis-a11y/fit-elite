import { useContext } from 'react'
import { ToastContext, type ToastContextValue } from '@/context/ToastContext'

export function useToast(): { addToast: ToastContextValue['addToast'] } {
  const { addToast } = useContext(ToastContext)
  return { addToast }
}
