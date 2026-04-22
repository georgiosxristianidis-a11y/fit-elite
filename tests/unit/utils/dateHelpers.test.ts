import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatRelativeDate, formatDuration, getWeekStart } from '@/utils/dateHelpers'
import { formatDuration as fmtDuration } from '@/utils/formatDuration'

// Pin "now" so tests are deterministic
const FIXED_NOW = new Date('2026-04-22T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('formatRelativeDate', () => {
  it('returns "Today" for a date earlier today', () => {
    const today = new Date('2026-04-22T08:00:00Z')
    expect(formatRelativeDate(today)).toBe('Today')
  })

  it('returns "Yesterday" for a date 1 day ago', () => {
    const yesterday = new Date('2026-04-21T10:00:00Z')
    expect(formatRelativeDate(yesterday)).toBe('Yesterday')
  })

  it('returns formatted date for older dates', () => {
    const old = new Date('2026-04-10T10:00:00Z')
    const result = formatRelativeDate(old)
    expect(result).toMatch(/10/)
    expect(result).toMatch(/Apr/)
  })
})

describe('formatDuration (util)', () => {
  it('formats sub-hour duration as "Xm"', () => {
    const start = new Date('2026-04-22T10:00:00Z')
    const end = new Date('2026-04-22T10:45:00Z')
    expect(fmtDuration(start, end)).toBe('45m')
  })

  it('formats hour-plus duration as "Xh Ym"', () => {
    const start = new Date('2026-04-22T09:00:00Z')
    const end = new Date('2026-04-22T10:30:00Z')
    expect(fmtDuration(start, end)).toBe('1h 30m')
  })

  it('returns "<1m" for very short durations', () => {
    const start = new Date('2026-04-22T10:00:00Z')
    const end = new Date('2026-04-22T10:00:30Z')
    expect(fmtDuration(start, end)).toBe('<1m')
  })
})

describe('getWeekStart', () => {
  it('returns the Monday of the given week at midnight', () => {
    // Wednesday 2026-04-22 → Monday 2026-04-20
    const result = getWeekStart(new Date('2026-04-22T15:00:00'))
    expect(result.getDay()).toBe(1) // Monday
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
  })

  it('handles Monday input correctly (same day)', () => {
    const monday = new Date('2026-04-20T09:00:00')
    const result = getWeekStart(monday)
    expect(result.getDay()).toBe(1)
    expect(result.getDate()).toBe(20)
  })

  it('handles Sunday as the last day of the previous week', () => {
    const sunday = new Date('2026-04-19T09:00:00') // Sunday
    const result = getWeekStart(sunday)
    expect(result.getDay()).toBe(1)
    expect(result.getDate()).toBe(13) // Monday April 13
  })
})
