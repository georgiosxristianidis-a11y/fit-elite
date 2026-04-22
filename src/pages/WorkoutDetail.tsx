import { useLiveQuery } from 'dexie-react-hooks'
import { useParams, useNavigate } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { getWorkoutWithEntries, getTotalVolumeForWorkout, deleteWorkout } from '@/db/queries/workout.queries'
import { getPRSetIds } from '@/db/queries/pr.queries'
import { useSettingsStore } from '@/store/settingsStore'
import { formatDuration } from '@/utils/formatDuration'
import { formatFullDate } from '@/utils/dateHelpers'
import { formatWeight, toDisplayUnit } from '@/utils/weightHelpers'
import type { ExerciseEntryWithSets, WeightUnit } from '@/types/workout.types'

interface ExerciseDetailCardProps {
  entry: ExerciseEntryWithSets
  prSetIds: Set<number>
  weightUnit: WeightUnit
}

function ExerciseDetailCard({ entry, prSetIds, weightUnit }: ExerciseDetailCardProps) {
  const totalVolume = entry.sets
    .filter((s) => s.completed)
    .reduce((sum, s) => sum + s.reps * s.weight, 0)

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-slate-200">{entry.exercise.name}</p>
        <Badge>{entry.exercise.muscleGroup}</Badge>
      </div>

      {entry.sets.length === 0 && (
        <p className="text-xs text-slate-600">No sets recorded</p>
      )}

      <ul className="space-y-1.5" aria-label={`Sets for ${entry.exercise.name}`}>
        {entry.sets.map((set, i) => (
          <li
            key={set.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="text-slate-500 w-12 flex-shrink-0">
              {set.setType === 'warmup' ? 'W' : `Set ${i + 1}`}
            </span>
            <span className="text-slate-300 flex-1">
              {set.reps} reps × {formatWeight(set.weight, weightUnit)}
            </span>
            {prSetIds.has(set.id!) && (
              <span
                className="text-xs font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-1.5 py-0.5 rounded-full"
                aria-label="Personal record"
              >
                PR
              </span>
            )}
          </li>
        ))}
      </ul>

      {totalVolume > 0 && (
        <p className="text-xs text-slate-600 pt-1 border-t border-slate-700">
          Volume: {toDisplayUnit(totalVolume, weightUnit).toLocaleString()} {weightUnit}
        </p>
      )}
    </Card>
  )
}

export function WorkoutDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { weightUnit } = useSettingsStore()

  const workoutId = id ? parseInt(id, 10) : null

  const handleDelete = async () => {
    if (!workoutId || isNaN(workoutId)) return
    const confirmed = window.confirm('Delete this workout? This cannot be undone.')
    if (!confirmed) return
    await deleteWorkout(workoutId)
    navigate('/history')
  }

  const workout = useLiveQuery(
    () => (workoutId ? getWorkoutWithEntries(workoutId) : undefined),
    [workoutId]
  )
  const totalVolume = useLiveQuery(
    () => (workoutId ? getTotalVolumeForWorkout(workoutId) : 0),
    [workoutId]
  )
  const prSetIds = useLiveQuery(() => getPRSetIds(), [])

  if (workoutId === null || isNaN(workoutId)) {
    return (
      <>
        <TopBar title="Not found" right={<Button variant="ghost" size="sm" onClick={() => navigate('/history')}>Back</Button>} />
        <PageContainer className="flex items-center justify-center">
          <p className="text-slate-500">Workout not found.</p>
        </PageContainer>
      </>
    )
  }

  if (workout === undefined) {
    return (
      <>
        <TopBar title="Workout" right={<Button variant="ghost" size="sm" onClick={() => navigate('/history')}>Back</Button>} />
        <PageContainer className="px-4 py-5">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-800 animate-pulse" />
            ))}
          </div>
        </PageContainer>
      </>
    )
  }

  const duration = workout.endedAt
    ? formatDuration(workout.startedAt, workout.endedAt)
    : 'In progress'

  return (
    <>
      <TopBar
        title={workout.name ?? formatFullDate(workout.startedAt)}
        right={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
              ← Back
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} aria-label="Delete workout">
              Delete
            </Button>
          </div>
        }
      />
      <PageContainer className="px-4 py-5 space-y-4">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-800 rounded-2xl p-3 text-center border border-slate-700">
            <p className="text-lg font-bold text-indigo-400">{duration}</p>
            <p className="text-xs text-slate-500 mt-0.5">Duration</p>
          </div>
          <div className="bg-slate-800 rounded-2xl p-3 text-center border border-slate-700">
            <p className="text-lg font-bold text-indigo-400">
              {toDisplayUnit(totalVolume ?? 0, weightUnit).toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Vol. {weightUnit}</p>
          </div>
          <div className="bg-slate-800 rounded-2xl p-3 text-center border border-slate-700">
            <p className="text-lg font-bold text-indigo-400">
              {workout.entries.length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Exercises</p>
          </div>
        </div>

        {/* Exercise detail cards */}
        {workout.entries.length === 0 ? (
          <p className="text-center text-slate-600 text-sm py-8">No exercises logged.</p>
        ) : (
          workout.entries.map((entry) => (
            <ExerciseDetailCard
              key={entry.id}
              entry={entry}
              prSetIds={prSetIds ?? new Set()}
              weightUnit={weightUnit}
            />
          ))
        )}

        {/* Notes */}
        {workout.notes && (
          <Card>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Notes
            </p>
            <p className="text-sm text-slate-300">{workout.notes}</p>
          </Card>
        )}
      </PageContainer>
    </>
  )
}
