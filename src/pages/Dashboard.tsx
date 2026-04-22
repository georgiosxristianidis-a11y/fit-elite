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
import { getCurrentStreak, getWeeklyVolume } from '@/db/queries/stats.queries'
import { useSettingsStore } from '@/store/settingsStore'
import { formatDuration } from '@/utils/formatDuration'
import { formatRelativeDate } from '@/utils/dateHelpers'
import type { Workout } from '@/types/workout.types'

function WorkoutRow({ workout }: { workout: Workout }) {
  const navigate = useNavigate()
  const { weightUnit } = useSettingsStore()
  return (
    <Card
      onClick={() => navigate(`/history/${workout.id}`)}
      className="flex items-center justify-between gap-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">
          {workout.name ?? formatRelativeDate(workout.startedAt)}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {formatDuration(workout.startedAt, workout.endedAt)} ·{' '}
          {workout.endedAt ? weightUnit : 'active'}
        </p>
      </div>
      <span className="text-slate-600 text-lg flex-shrink-0">›</span>
    </Card>
  )
}

interface StatCardProps {
  value: number | string | undefined
  label: string
  unit?: string
}

function StatCard({ value, label, unit }: StatCardProps) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-bold text-indigo-400 leading-none">
        {value ?? <span className="text-slate-700 animate-pulse">—</span>}
        {value !== undefined && unit && (
          <span className="text-xs text-slate-500 font-normal ml-1">{unit}</span>
        )}
      </p>
      <p className="text-xs text-slate-500 mt-1.5">{label}</p>
    </Card>
  )
}

export function Dashboard() {
  const { isActive, activeWorkoutId, start } = useWorkoutSession()
  const { weightUnit } = useSettingsStore()
  const isOnline = useOnlineStatus()
  const navigate = useNavigate()

  const recentWorkouts = useLiveQuery(() => getRecentWorkouts(5), [])
  const weeklyCount = useLiveQuery(() => getWeeklyWorkoutCount(), [])
  const totalCount = useLiveQuery(() => getCompletedWorkoutsCount(), [])
  const streak = useLiveQuery(() => getCurrentStreak(), [])
  const weeklyVolume = useLiveQuery(() => getWeeklyVolume(), [])

  const handleStartWorkout = async () => {
    if (isActive) {
      navigate('/workout')
      return
    }
    await start()
    navigate('/workout')
  }

  const formattedVolume =
    weeklyVolume !== undefined
      ? weeklyVolume >= 1000
        ? `${(weeklyVolume / 1000).toFixed(1)}k`
        : String(weeklyVolume)
      : undefined

  return (
    <>
      <TopBar
        title="fit-elite"
        right={
          !isOnline ? (
            <span className="text-xs text-yellow-400 font-medium px-2 py-1 bg-yellow-400/10 rounded-lg">
              Offline
            </span>
          ) : undefined
        }
      />
      <PageContainer className="px-4 py-5 space-y-5">
        {/* 2×2 stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard value={weeklyCount} label="This week" />
          <StatCard value={streak !== undefined ? `${streak}wk` : undefined} label="Streak" />
          <StatCard value={formattedVolume} label="Weekly vol." unit={weightUnit} />
          <StatCard value={totalCount} label="All time" />
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
        {(recentWorkouts?.filter((w) => w.endedAt).length ?? 0) > 0 && (
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

        {recentWorkouts !== undefined && recentWorkouts.filter((w) => w.endedAt).length === 0 && (
          <p className="text-center text-slate-600 text-sm py-8">
            No workouts yet — start your first one!
          </p>
        )}
      </PageContainer>
    </>
  )
}
