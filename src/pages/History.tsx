import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { getRecentWorkouts } from '@/db/queries/workout.queries'
import { formatDuration } from '@/utils/formatDuration'
import { formatFullDate } from '@/utils/dateHelpers'
import type { Workout } from '@/types/workout.types'

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
        <p className="text-xs text-slate-500">{formatFullDate(workout.startedAt)}</p>
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
        {workouts === undefined && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-slate-800 animate-pulse" />
            ))}
          </div>
        )}

        {workouts?.length === 0 && (
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
