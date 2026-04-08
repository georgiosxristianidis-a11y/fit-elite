import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useWorkoutSession } from '@/hooks/useWorkoutSession'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import {
  getRecentWorkouts,
  getWeeklyWorkoutCount,
  getCompletedWorkoutsCount,
} from '@/db/queries/workout.queries'
import type { Workout } from '@/types/workout.types'

function formatDuration(start: Date, end?: Date): string {
  const ms = (end ?? new Date()).getTime() - start.getTime()
  const totalMinutes = Math.floor(ms / 60_000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function WorkoutRow({ workout }: { workout: Workout }) {
  const navigate = useNavigate()
  return (
    <Card onClick={() => navigate(`/history/${workout.id}`)} className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">
          {workout.name ?? formatDate(workout.startedAt)}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {formatDuration(workout.startedAt, workout.endedAt)}
        </p>
      </div>
      <span className="text-slate-600 text-lg flex-shrink-0">›</span>
    </Card>
  )
}

export function Dashboard() {
  const { isActive, activeWorkoutId, start } = useWorkoutSession()
  const isOnline = useOnlineStatus()
  const navigate = useNavigate()

  const recentWorkouts = useLiveQuery(() => getRecentWorkouts(5), [])
  const weeklyCount = useLiveQuery(() => getWeeklyWorkoutCount(), [])
  const totalCount = useLiveQuery(() => getCompletedWorkoutsCount(), [])

  const handleStartWorkout = async () => {
    if (isActive) {
      navigate('/workout')
      return
    }
    await start()
    navigate('/workout')
  }

  return (
    <>
      <TopBar
        title="fit-elite"
        right={
          !isOnline && (
            <span className="text-xs text-yellow-400 font-medium">Offline</span>
          )
        }
      />
      <PageContainer className="px-4 py-5 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="text-center">
            <p className="text-3xl font-bold text-indigo-400">{weeklyCount ?? '—'}</p>
            <p className="text-xs text-slate-500 mt-1">This week</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold text-indigo-400">{totalCount ?? '—'}</p>
            <p className="text-xs text-slate-500 mt-1">All time</p>
          </Card>
        </div>

        {/* Start / resume workout */}
        <Button
          size="lg"
          fullWidth
          variant={isActive ? 'secondary' : 'primary'}
          onClick={handleStartWorkout}
          aria-label={isActive ? 'Resume active workout' : 'Start new workout'}
        >
          {isActive ? `▶ Resume workout #${activeWorkoutId}` : '+ Start workout'}
        </Button>

        {/* Recent workouts */}
        {(recentWorkouts?.length ?? 0) > 0 && (
          <section aria-label="Recent workouts">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Recent
            </h2>
            <div className="space-y-2">
              {recentWorkouts
                ?.filter((w) => w.endedAt !== undefined)
                .map((w) => (
                  <WorkoutRow key={w.id} workout={w} />
                ))}
            </div>
          </section>
        )}

        {(recentWorkouts?.length ?? 0) === 0 && (
          <p className="text-center text-slate-600 text-sm py-8">
            No workouts yet. Start your first one!
          </p>
        )}
      </PageContainer>
    </>
  )
}
