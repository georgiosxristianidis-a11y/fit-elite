/**
 * Returns true if `newWeight` exceeds `previousBest` for the same rep count.
 * Pure function — no DB access, easy to unit-test.
 */
export function isNewWeightPR(newWeight: number, previousBest: number): boolean {
  return newWeight > previousBest
}

/**
 * Epley 1RM estimate: w × (1 + reps / 30).
 * Result is rounded to 1 decimal place.
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

/**
 * Given a list of previous bests `{ reps, weight }[]` and a new set,
 * returns true if the new set establishes a new PR at its rep count.
 */
export function isPRForRepCount(
  newReps: number,
  newWeight: number,
  history: { reps: number; weight: number }[]
): boolean {
  const best = history
    .filter((s) => s.reps === newReps)
    .reduce((max, s) => Math.max(max, s.weight), 0)
  return isNewWeightPR(newWeight, best)
}
