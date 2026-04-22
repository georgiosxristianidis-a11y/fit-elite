import { describe, it, expect } from 'vitest'
import { isNewWeightPR, estimateOneRepMax, isPRForRepCount } from '@/utils/detectPR'

describe('isNewWeightPR', () => {
  it('returns true when new weight exceeds previous best', () => {
    expect(isNewWeightPR(105, 100)).toBe(true)
  })

  it('returns false when new weight equals previous best', () => {
    expect(isNewWeightPR(100, 100)).toBe(false)
  })

  it('returns false when new weight is less than previous best', () => {
    expect(isNewWeightPR(95, 100)).toBe(false)
  })

  it('returns true when there is no previous record (previousBest = 0)', () => {
    expect(isNewWeightPR(60, 0)).toBe(true)
  })
})

describe('estimateOneRepMax', () => {
  it('returns weight as-is for 1 rep', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100)
  })

  it('applies Epley formula for multiple reps', () => {
    // 100 * (1 + 5/30) = 100 * 1.1667 = 116.7
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.7, 0)
  })

  it('returns 0 for invalid inputs', () => {
    expect(estimateOneRepMax(0, 5)).toBe(0)
    expect(estimateOneRepMax(100, 0)).toBe(0)
    expect(estimateOneRepMax(-10, 5)).toBe(0)
  })

  it('increases as reps increase for the same weight', () => {
    const e5 = estimateOneRepMax(80, 5)
    const e10 = estimateOneRepMax(80, 10)
    expect(e10).toBeGreaterThan(e5)
  })
})

describe('isPRForRepCount', () => {
  const history = [
    { reps: 5, weight: 100 },
    { reps: 5, weight: 95 },
    { reps: 3, weight: 110 },
    { reps: 8, weight: 85 },
  ]

  it('returns true when new weight beats the best at that rep count', () => {
    expect(isPRForRepCount(5, 105, history)).toBe(true)
  })

  it('returns false when new weight ties the best', () => {
    expect(isPRForRepCount(5, 100, history)).toBe(false)
  })

  it('returns false when new weight is below the best', () => {
    expect(isPRForRepCount(5, 90, history)).toBe(false)
  })

  it('returns true when rep count has no prior history (first attempt = PR)', () => {
    expect(isPRForRepCount(1, 120, history)).toBe(true)
  })

  it('returns true when history is empty', () => {
    expect(isPRForRepCount(5, 100, [])).toBe(true)
  })
})
