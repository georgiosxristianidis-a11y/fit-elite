import { useWorkoutSessionStore } from '@/store/workoutSessionStore'
import { createWorkout, endWorkout } from '@/db/queries/workout.queries'

/**
 * Provides start/end controls for the active workout session.
 * All writes go to IndexedDB first; the store only tracks the active ID.
 */
export function useWorkoutSession() {
  const { activeWorkoutId, startSession, endSession } = useWorkoutSessionStore()

  const start = async (): Promise<number> => {
    const id = await createWorkout()
    startSession(id)
    return id
  }

  const end = async (): Promise<void> => {
    if (activeWorkoutId === null) return
    await endWorkout(activeWorkoutId)
    endSession()
  }

  return {
    activeWorkoutId,
    isActive: activeWorkoutId !== null,
    start,
    end,
  }
}
