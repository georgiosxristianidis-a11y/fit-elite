import { useEffect, useRef } from 'react'
import { useTimer } from '@/hooks/useTimer'
import { Button } from '@/components/ui/Button'

interface RestTimerProps {
  durationSeconds: number
  onComplete: () => void
  onDismiss: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const RADIUS = 80
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function RestTimer({ durationSeconds, onComplete, onDismiss }: RestTimerProps) {
  const { secondsLeft, start, addSeconds } = useTimer()
  const durationRef = useRef(durationSeconds)
  const completedRef = useRef(false)

  useEffect(() => {
    durationRef.current = durationSeconds
    completedRef.current = false
    start(durationSeconds)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (secondsLeft === 0 && !completedRef.current) {
      completedRef.current = true
      navigator.vibrate?.([200, 100, 200])
      onComplete()
    }
  }, [secondsLeft, onComplete])

  const progress = durationRef.current > 0 ? secondsLeft / durationRef.current : 0
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress)

  // ARIA live announcement
  const liveAnnouncement =
    secondsLeft === 0
      ? 'Rest complete'
      : secondsLeft <= 3
        ? `Rest ending in ${secondsLeft}`
        : ''

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/95 backdrop-blur flex flex-col items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Rest timer"
    >
      {/* ARIA live region — visually hidden */}
      <span
        className="sr-only"
        aria-live="assertive"
        aria-atomic="true"
      >
        {liveAnnouncement}
      </span>

      {/* Circular progress ring */}
      <div className="relative flex items-center justify-center mb-8">
        <svg
          width={200}
          height={200}
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          {/* Background ring */}
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            stroke="#1e293b"
            strokeWidth="6"
          />
          {/* Progress ring — starts at top, shrinks clockwise */}
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            stroke="#6366f1"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dashoffset 0.9s linear' }}
          />
        </svg>

        {/* Countdown text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-5xl font-bold text-slate-100 tabular-nums"
            aria-label={`${secondsLeft} seconds remaining`}
          >
            {formatTime(secondsLeft)}
          </span>
          <span className="text-sm text-slate-500 mt-1">rest</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="md"
          onClick={() => addSeconds(30)}
          aria-label="Add 30 seconds to rest timer"
        >
          +30s
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={onDismiss}
          aria-label="Skip rest timer"
        >
          Skip
        </Button>
      </div>
    </div>
  )
}
