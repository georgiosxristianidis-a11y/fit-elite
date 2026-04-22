import { useState, useEffect, useRef, useCallback } from 'react'

interface UseTimerReturn {
  secondsLeft: number
  isRunning: boolean
  start: (seconds: number) => void
  pause: () => void
  reset: () => void
  addSeconds: (n: number) => void
}

export function useTimer(): UseTimerReturn {
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearCurrentInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isRunning) return

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearCurrentInterval()
          setIsRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return clearCurrentInterval
  }, [isRunning, clearCurrentInterval])

  // Cleanup on unmount
  useEffect(() => {
    return clearCurrentInterval
  }, [clearCurrentInterval])

  const start = useCallback((seconds: number) => {
    clearCurrentInterval()
    setSecondsLeft(seconds)
    setIsRunning(true)
  }, [clearCurrentInterval])

  const pause = useCallback(() => {
    setIsRunning(false)
    clearCurrentInterval()
  }, [clearCurrentInterval])

  const reset = useCallback(() => {
    setIsRunning(false)
    clearCurrentInterval()
    setSecondsLeft(0)
  }, [clearCurrentInterval])

  const addSeconds = useCallback((n: number) => {
    setSecondsLeft((prev) => prev + n)
  }, [])

  return { secondsLeft, isRunning, start, pause, reset, addSeconds }
}
