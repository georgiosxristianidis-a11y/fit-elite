import { db } from '@/db/schema'
import { getWeekStart } from '@/utils/dateHelpers'

/**
 * Current training streak in consecutive weeks (Monday-based).
 * If the current week has no workouts yet, the streak is computed from
 * last week — so a Monday morning doesn't immediately reset the count.
 */
export async function getCurrentStreak(): Promise<number> {
  const workouts = await db.workouts.filter((w) => w.endedAt !== undefined).toArray()
  if (workouts.length === 0) return 0

  const trainedWeeks = new Set(
    workouts.map((w) => getWeekStart(w.startedAt).getTime())
  )

  let checkTime = getWeekStart(new Date()).getTime()

  // If this week has no training yet, start from last week
  if (!trainedWeeks.has(checkTime)) {
    checkTime -= 7 * 86_400_000
  }

  let streak = 0
  while (trainedWeeks.has(checkTime)) {
    streak++
    checkTime -= 7 * 86_400_000
  }
  return streak
}

/** Total volume (reps × weight) for completed sets in the last 7 days. */
export async function getWeeklyVolume(): Promise<number> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000)

  const workouts = await db.workouts
    .where('startedAt')
    .above(weekAgo)
    .filter((w) => w.endedAt !== undefined)
    .toArray()

  let total = 0
  for (const workout of workouts) {
    const entries = await db.exerciseEntries
      .where('workoutId')
      .equals(workout.id!)
      .toArray()
    for (const entry of entries) {
      const sets = await db.sets
        .where('exerciseEntryId')
        .equals(entry.id!)
        .filter((s) => s.completed)
        .toArray()
      for (const s of sets) {
        total += s.reps * s.weight
      }
    }
  }
  return total
}

/** Number of completed workouts in the current calendar month. */
export async function getMonthlyWorkoutCount(): Promise<number> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  return db.workouts
    .where('startedAt')
    .above(monthStart)
    .filter((w) => w.endedAt !== undefined)
    .count()
}
