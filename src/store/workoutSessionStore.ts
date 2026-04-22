import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WorkoutSessionState {
  activeWorkoutId: number | null
  startSession: (id: number) => void
  endSession: () => void
}

export const useWorkoutSessionStore = create<WorkoutSessionState>()(
  persist(
    (set) => ({
      activeWorkoutId: null,
      startSession: (id: number) => set({ activeWorkoutId: id }),
      endSession: () => set({ activeWorkoutId: null }),
    }),
    { name: 'fit-elite-session' }
  )
)
