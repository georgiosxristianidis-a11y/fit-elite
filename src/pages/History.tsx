import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { getRecentWorkouts } from '@/db/queries/workout.queries'
import type { Workout } from '@/types/workout.types'

function formatDuration(start: Date, end?: Date): string {
  const ms = (end ?? new Date()).getTime() - start.getTime()
  const totalMinutes = Math.floor(ms / 60_000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function WorkoutHistoryCard({ workout }: { workout: Workout }) {
  const navigate = useNavigate()
  const isCompleted = workout.endedAt !== undefined

  return (
    <Card
      onClick={isCompleted ? () => navigate(`/history/${workout.id}`) : undefined}
      className="flex items-start justify-between gap-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-slate-200 truncate">
            {workout.name ?? 'Workout'}
          </p>
          {!isCompleted && (
            <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">{formatDateTime(workout.startedAt)}</p>
        {isCompleted && (
          <p className="text-xs text-slate-600 mt-0.5">
            {formatDuration(workout.startedAt, workout.endedAt)}
          </p>
        )}
      </div>
      {isCompleted && <span className="text-slate-600 text-lg flex-shrink-0">›</span>}
    </Card>
  )
}

export function History() {
  const workouts = useLiveQuery(() => getRecentWorkouts(50), [])

  return (
    <>
      <TopBar title="History" />
      <PageContainer className="px-4 py-5">
        {(workouts?.length ?? 0) === 0 && (
          <p className="text-center text-slate-600 text-sm py-12">
            No completed workouts yet.
          </p>
        )}

        <ul className="space-y-2" role="list" aria-label="Workout history">
          {workouts?.map((w) => (
            <li key={w.id}>
              <WorkoutHistoryCard workout={w} />
            </li>
          ))}
        </ul>
      </PageContainer>
    </>
  )
}
