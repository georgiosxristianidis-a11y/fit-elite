import type { WeightUnit } from '@/types/workout.types'

const KG_TO_LBS = 2.20462
const LBS_TO_KG = 0.453592

export function kgToLbs(kg: number): number {
  return Math.round(kg * KG_TO_LBS * 10) / 10
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 100) / 100
}

/** Convert a weight stored in kg to the user's display unit. */
export function toDisplayUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lbs' ? kgToLbs(kg) : kg
}

/** Convert a weight entered in the user's unit back to kg for storage. */
export function toStorageKg(value: number, unit: WeightUnit): number {
  return unit === 'lbs' ? lbsToKg(value) : value
}

/** Return a display-ready string: "60 kg" or "132.3 lbs". */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const v = toDisplayUnit(kg, unit)
  return `${v} ${unit}`
}
