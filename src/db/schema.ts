import Dexie, { type EntityTable } from 'dexie'
import type { Exercise, WorkoutSet, ExerciseEntry, Workout, PR, UserSettings } from '@/types/workout.types'

class FitEliteDatabase extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  exerciseEntries!: EntityTable<ExerciseEntry, 'id'>
  sets!: EntityTable<WorkoutSet, 'id'>
  prs!: EntityTable<PR, 'id'>
  settings!: EntityTable<UserSettings, 'id'>

  constructor() {
    super('fit-elite-db')

    this.version(1).stores({
      exercises: '++id, name, muscleGroup, equipment, isCustom',
      workouts: '++id, startedAt, endedAt',
      exerciseEntries: '++id, workoutId, exerciseId, order',
      sets: '++id, exerciseEntryId, completed, createdAt',
      prs: '++id, exerciseId, reps, achievedAt',
      settings: '++id',
    })

    // Seed data on first database open (never runs on subsequent opens)
    this.on('populate', async () => {
      await this.exercises.bulkAdd(DEFAULT_EXERCISES)
      await this.settings.add({
        weightUnit: 'kg',
        restTimerSeconds: 90,
        sessionsCount: 0,
        installPromptShown: false,
        theme: 'dark',
      })
    })
  }
}

export const db = new FitEliteDatabase()

// ─── Default exercise library ───────────────────────────────────────────────
const DEFAULT_EXERCISES: Omit<Exercise, 'id'>[] = [
  // Chest
  { name: 'Bench Press', muscleGroup: 'chest', equipment: 'Barbell', isCustom: false },
  { name: 'Incline Bench Press', muscleGroup: 'chest', equipment: 'Barbell', isCustom: false },
  { name: 'Dumbbell Fly', muscleGroup: 'chest', equipment: 'Dumbbell', isCustom: false },
  { name: 'Push-up', muscleGroup: 'chest', equipment: 'Bodyweight', isCustom: false },
  { name: 'Cable Crossover', muscleGroup: 'chest', equipment: 'Cable', isCustom: false },
  // Back
  { name: 'Deadlift', muscleGroup: 'back', equipment: 'Barbell', isCustom: false },
  { name: 'Pull-up', muscleGroup: 'back', equipment: 'Bodyweight', isCustom: false },
  { name: 'Barbell Row', muscleGroup: 'back', equipment: 'Barbell', isCustom: false },
  { name: 'Lat Pulldown', muscleGroup: 'back', equipment: 'Cable', isCustom: false },
  { name: 'Seated Cable Row', muscleGroup: 'back', equipment: 'Cable', isCustom: false },
  { name: 'Dumbbell Row', muscleGroup: 'back', equipment: 'Dumbbell', isCustom: false },
  // Shoulders
  { name: 'Overhead Press', muscleGroup: 'shoulders', equipment: 'Barbell', isCustom: false },
  { name: 'Dumbbell Shoulder Press', muscleGroup: 'shoulders', equipment: 'Dumbbell', isCustom: false },
  { name: 'Lateral Raise', muscleGroup: 'shoulders', equipment: 'Dumbbell', isCustom: false },
  { name: 'Face Pull', muscleGroup: 'shoulders', equipment: 'Cable', isCustom: false },
  // Legs
  { name: 'Squat', muscleGroup: 'legs', equipment: 'Barbell', isCustom: false },
  { name: 'Romanian Deadlift', muscleGroup: 'legs', equipment: 'Barbell', isCustom: false },
  { name: 'Leg Press', muscleGroup: 'legs', equipment: 'Machine', isCustom: false },
  { name: 'Leg Curl', muscleGroup: 'legs', equipment: 'Machine', isCustom: false },
  { name: 'Leg Extension', muscleGroup: 'legs', equipment: 'Machine', isCustom: false },
  { name: 'Calf Raise', muscleGroup: 'legs', equipment: 'Machine', isCustom: false },
  { name: 'Bulgarian Split Squat', muscleGroup: 'legs', equipment: 'Dumbbell', isCustom: false },
  // Arms
  { name: 'Barbell Curl', muscleGroup: 'arms', equipment: 'Barbell', isCustom: false },
  { name: 'Dumbbell Curl', muscleGroup: 'arms', equipment: 'Dumbbell', isCustom: false },
  { name: 'Tricep Pushdown', muscleGroup: 'arms', equipment: 'Cable', isCustom: false },
  { name: 'Skull Crusher', muscleGroup: 'arms', equipment: 'Barbell', isCustom: false },
  { name: 'Hammer Curl', muscleGroup: 'arms', equipment: 'Dumbbell', isCustom: false },
  // Core
  { name: 'Plank', muscleGroup: 'core', equipment: 'Bodyweight', isCustom: false },
  { name: 'Crunch', muscleGroup: 'core', equipment: 'Bodyweight', isCustom: false },
  { name: 'Ab Rollout', muscleGroup: 'core', equipment: 'Ab Wheel', isCustom: false },
  { name: 'Hanging Leg Raise', muscleGroup: 'core', equipment: 'Bodyweight', isCustom: false },
  // Cardio
  { name: 'Treadmill Run', muscleGroup: 'cardio', equipment: 'Machine', isCustom: false },
  { name: 'Cycling', muscleGroup: 'cardio', equipment: 'Machine', isCustom: false },
  { name: 'Jump Rope', muscleGroup: 'cardio', equipment: 'Bodyweight', isCustom: false },
  { name: 'Rowing Machine', muscleGroup: 'cardio', equipment: 'Machine', isCustom: false },
]
