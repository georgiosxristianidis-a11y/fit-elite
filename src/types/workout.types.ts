export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'core'
  | 'cardio'
  | 'fullBody'

export type SetType = 'warmup' | 'working' | 'dropset' | 'failure'

export type WeightUnit = 'kg' | 'lbs'

export interface Exercise {
  id?: number
  name: string
  muscleGroup: MuscleGroup
  equipment: string
  instructions?: string
  isCustom: boolean
}

export interface WorkoutSet {
  id?: number
  exerciseEntryId: number
  reps: number
  weight: number
  setType: SetType
  completed: boolean
  notes?: string
  restSeconds?: number
  createdAt: Date
}

export interface ExerciseEntry {
  id?: number
  workoutId: number
  exerciseId: number
  order: number
  notes?: string
}

export interface Workout {
  id?: number
  startedAt: Date
  endedAt?: Date
  notes?: string
  name?: string
}

export interface PR {
  id?: number
  exerciseId: number
  reps: number
  weight: number
  setId: number
  achievedAt: Date
}

export interface UserSettings {
  id?: number
  weightUnit: WeightUnit
  restTimerSeconds: number
  sessionsCount: number
  installPromptShown: boolean
  theme: 'dark' | 'light'
}

// Resolved relation types used at the UI layer
export interface WorkoutWithEntries extends Workout {
  entries: ExerciseEntryWithSets[]
}

export interface ExerciseEntryWithSets extends ExerciseEntry {
  exercise: Exercise
  sets: WorkoutSet[]
}
