import { useEffect, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { BottomNav } from '@/components/layout/BottomNav'
import { InstallBanner } from '@/components/layout/InstallBanner'
import { ToastList } from '@/components/ui/ToastList'
import { Dashboard } from '@/pages/Dashboard'
import { WorkoutSession } from '@/pages/WorkoutSession'
import { History } from '@/pages/History'
import { WorkoutDetail } from '@/pages/WorkoutDetail'
import { Exercises } from '@/pages/Exercises'
import { Progress } from '@/pages/Progress'
import { Settings } from '@/pages/Settings'
import { useSettingsStore } from '@/store/settingsStore'
import { ToastProvider } from '@/context/ToastContext'

// ─── Error Boundary ──────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // TODO: remove — replace with proper error reporting in production
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
          <p className="text-4xl">⚠️</p>
          <p className="text-slate-300 font-semibold">Something went wrong.</p>
          <p className="text-slate-600 text-sm">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium min-h-[44px]"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── App shell ───────────────────────────────────────────────────────────────

function AppShell() {
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
    <div className="flex flex-col h-full">
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workout" element={<WorkoutSession />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<WorkoutDetail />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </ErrorBoundary>
      <ToastList />
      <InstallBanner />
      <BottomNav />
    </div>
  )
}

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ToastProvider>
  )
}
