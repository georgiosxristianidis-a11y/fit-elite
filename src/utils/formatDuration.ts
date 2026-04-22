/**
 * Formats elapsed time between two dates as "1h 23m" or "45m".
 * If `end` is omitted, uses the current time (for active sessions).
 */
export function formatDuration(start: Date, end?: Date): string {
  const ms = (end ?? new Date()).getTime() - start.getTime()
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 1) return '<1m'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** Formats seconds as "1:30" (minutes:seconds, zero-padded). */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
