import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { BottomNav } from '@/components/layout/BottomNav'
import { Dashboard } from '@/pages/Dashboard'
import { WorkoutSession } from '@/pages/WorkoutSession'
import { History } from '@/pages/History'
import { Exercises } from '@/pages/Exercises'
import { useSettingsStore } from '@/store/settingsStore'

export function App() {
  const setInstallPromptEvent = useSettingsStore((s) => s.setInstallPromptEvent)

  // Capture the install prompt — show it after the user's 3rd session (see CLAUDE.md)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setInstallPromptEvent(e as any)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [setInstallPromptEvent])

  return (
    <BrowserRouter>
      <div className="flex flex-col h-full">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workout" element={<WorkoutSession />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<History />} />
          <Route path="/exercises" element={<Exercises />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
