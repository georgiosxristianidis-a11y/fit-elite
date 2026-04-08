import { db } from '@/db/schema'
import type {
  Workout,
  WorkoutWithEntries,
  ExerciseEntryWithSets,
  SetType,
} from '@/types/workout.types'

export async function createWorkout(): Promise<number> {
  return db.workouts.add({ startedAt: new Date() })
}

export async function endWorkout(id: number): Promise<void> {
  await db.workouts.update(id, { endedAt: new Date() })
  const settings = await db.settings.toCollection().first()
  if (settings?.id) {
    await db.settings.update(settings.id, {
      sessionsCount: (settings.sessionsCount ?? 0) + 1,
    })
  }
}

export async function getRecentWorkouts(limit = 20): Promise<Workout[]> {
  return db.workouts.orderBy('startedAt').reverse().limit(limit).toArray()
}

export async function getWorkoutWithEntries(
  workoutId: number
): Promise<WorkoutWithEntries | undefined> {
  const workout = await db.workouts.get(workoutId)
  if (!workout) return undefined

  const entries = await db.exerciseEntries
    .where('workoutId')
    .equals(workoutId)
    .sortBy('order')

  const entriesWithSets: ExerciseEntryWithSets[] = await Promise.all(
    entries.map(async (entry) => {
      const [exercise, sets] = await Promise.all([
        db.exercises.get(entry.exerciseId),
        db.sets.where('exerciseEntryId').equals(entry.id!).sortBy('createdAt'),
      ])
      return { ...entry, exercise: exercise!, sets }
    })
  )

  return { ...workout, entries: entriesWithSets }
}

export async function addExerciseToWorkout(
  workoutId: number,
  exerciseId: number
): Promise<number> {
  const count = await db.exerciseEntries.where('workoutId').equals(workoutId).count()
  return db.exerciseEntries.add({ workoutId, exerciseId, order: count })
}

export async function logSet(
  exerciseEntryId: number,
  reps: number,
  weight: number,
  setType: SetType = 'working'
): Promise<number> {
  return db.sets.add({
    exerciseEntryId,
    reps,
    weight,
    setType,
    completed: true,
    createdAt: new Date(),
  })
}

export async function deleteSet(setId: number): Promise<void> {
  await db.sets.delete(setId)
}

export async function getWeeklyWorkoutCount(): Promise<number> {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  return db.workouts
    .where('startedAt')
    .above(weekAgo)
    .filter((w) => w.endedAt !== undefined)
    .count()
}

export async function getTotalVolumeForWorkout(workoutId: number): Promise<number> {
  const entries = await db.exerciseEntries.where('workoutId').equals(workoutId).toArray()
  let total = 0
  for (const entry of entries) {
    const sets = await db.sets.where('exerciseEntryId').equals(entry.id!).toArray()
    for (const set of sets) {
      if (set.completed) total += set.reps * set.weight
    }
  }
  return total
}

export async function getCompletedWorkoutsCount(): Promise<number> {
  return db.workouts.filter((w) => w.endedAt !== undefined).count()
}
