import { db } from '@/db/schema'
import type { Exercise, MuscleGroup } from '@/types/workout.types'

export async function getAllExercises(): Promise<Exercise[]> {
  return db.exercises.orderBy('name').toArray()
}

export async function getExercisesByMuscleGroup(group: MuscleGroup): Promise<Exercise[]> {
  return db.exercises.where('muscleGroup').equals(group).sortBy('name')
}

export async function getExerciseById(id: number): Promise<Exercise | undefined> {
  return db.exercises.get(id)
}

export async function searchExercises(query: string): Promise<Exercise[]> {
  const lower = query.toLowerCase()
  return db.exercises
    .filter((e) => e.name.toLowerCase().includes(lower))
    .toArray()
}

export async function addCustomExercise(
  data: Omit<Exercise, 'id' | 'isCustom'>
): Promise<number> {
  return db.exercises.add({ ...data, isCustom: true })
}
