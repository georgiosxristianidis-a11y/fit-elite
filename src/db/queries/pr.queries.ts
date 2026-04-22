import { db } from '@/db/schema'
import type { PR } from '@/types/workout.types'

/**
 * Checks if a newly logged set is a Personal Record for the given exercise
 * at the given rep count. If so, upserts the PR record and returns true.
 *
 * Algorithm:
 * 1. Find the current best PR weight for this exercise × rep count in the prs table.
 * 2. If the new weight exceeds it, save/update the PR and return true.
 */
export async function checkAndSavePR(
  exerciseId: number,
  reps: number,
  weight: number,
  setId: number
): Promise<boolean> {
  const existing = await db.prs
    .where('exerciseId')
    .equals(exerciseId)
    .filter((pr) => pr.reps === reps)
    .first()

  if (weight > (existing?.weight ?? 0)) {
    if (existing?.id) {
      await db.prs.update(existing.id, { weight, setId, achievedAt: new Date() })
    } else {
      await db.prs.add({ exerciseId, reps, weight, setId, achievedAt: new Date() })
    }
    return true
  }

  return false
}

/** All PR records for one exercise, sorted by rep count ascending. */
export async function getPRsByExercise(exerciseId: number): Promise<PR[]> {
  return db.prs.where('exerciseId').equals(exerciseId).sortBy('reps')
}

/**
 * Returns a Set of set IDs that hold a current PR.
 * Used by the WorkoutDetail page to render PR badges.
 */
export async function getPRSetIds(): Promise<Set<number>> {
  const prs = await db.prs.toArray()
  return new Set(prs.map((pr) => pr.setId))
}

/** All PRs ordered by most recently achieved. */
export async function getAllPRs(): Promise<PR[]> {
  return db.prs.orderBy('achievedAt').reverse().toArray()
}
