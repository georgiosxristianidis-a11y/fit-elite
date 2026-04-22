import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WeightUnit } from '@/types/workout.types'

// BeforeInstallPromptEvent is not part of standard TypeScript DOM types
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface SettingsState {
  weightUnit: WeightUnit
  restTimerSeconds: number
  installPromptEvent: BeforeInstallPromptEvent | null
  setWeightUnit: (unit: WeightUnit) => void
  setRestTimerSeconds: (seconds: number) => void
  setInstallPromptEvent: (event: BeforeInstallPromptEvent | null) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      weightUnit: 'kg',
      restTimerSeconds: 90,
      installPromptEvent: null,
      setWeightUnit: (unit) => set({ weightUnit: unit }),
      setRestTimerSeconds: (seconds) => set({ restTimerSeconds: seconds }),
      setInstallPromptEvent: (event) => set({ installPromptEvent: event }),
    }),
    {
      name: 'fit-elite-settings',
      // installPromptEvent is not serializable — exclude it from persistence
      partialize: (state) => ({
        weightUnit: state.weightUnit,
        restTimerSeconds: state.restTimerSeconds,
      }),
    }
  )
)
