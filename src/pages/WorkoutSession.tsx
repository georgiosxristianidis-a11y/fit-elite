import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useWorkoutSession } from '@/hooks/useWorkoutSession'
import { useSettingsStore } from '@/store/settingsStore'
import {
  getWorkoutWithEntries,
  addExerciseToWorkout,
  logSet,
  deleteSet,
} from '@/db/queries/workout.queries'
import { getAllExercises } from '@/db/queries/exercise.queries'
import type { ExerciseEntryWithSets } from '@/types/workout.types'

// ─── Set logger form ─────────────────────────────────────────────────────────

interface SetFormProps {
  entryId: number
  weightUnit: string
  onLogged: () => void
}

function SetForm({ entryId, weightUnit, onLogged }: SetFormProps) {
  const [reps, setReps] = useState('8')
  const [weight, setWeight] = useState('60')

  const handleLog = async () => {
    const r = parseInt(reps, 10)
    const w = parseFloat(weight)
    if (!r || !w || r <= 0 || w < 0) return
    await logSet(entryId, r, w)
    onLogged()
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <div className="flex-1">
        <label className="text-xs text-slate-500 block mb-1">Reps</label>
        <input
          type="number"
          min="1"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 text-center focus:outline-none focus:border-indigo-500 min-h-[44px]"
          inputMode="numeric"
          aria-label="Reps"
        />
      </div>
      <div className="flex-1">
        <label className="text-xs text-slate-500 block mb-1">Weight ({weightUnit})</label>
        <input
          type="number"
          min="0"
          step="0.5"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 text-center focus:outline-none focus:border-indigo-500 min-h-[44px]"
          inputMode="decimal"
          aria-label={`Weight in ${weightUnit}`}
        />
      </div>
      <div className="pt-5">
        <Button size="md" onClick={handleLog} aria-label="Log set">
          ✓
        </Button>
      </div>
    </div>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({
  entry,
  weightUnit,
  onSetLogged,
}: {
  entry: ExerciseEntryWithSets
  weightUnit: string
  onSetLogged: () => void
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-slate-200">{entry.exercise.name}</p>
        <Badge>{entry.exercise.muscleGroup}</Badge>
      </div>

      {/* Sets logged so far */}
      {entry.sets.length > 0 && (
        <ul className="space-y-1" aria-label={`Sets for ${entry.exercise.name}`}>
          {entry.sets.map((set, i) => (
            <li
              key={set.id}
              className="flex items-center justify-between text-sm text-slate-400"
            >
              <span>
                Set {i + 1} — {set.reps} reps × {set.weight} {weightUnit}
              </span>
              <button
                onClick={() => deleteSet(set.id!).then(onSetLogged)}
                className="text-slate-600 hover:text-red-400 transition-colors px-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
                aria-label={`Delete set ${i + 1}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <SetForm entryId={entry.id!} weightUnit={weightUnit} onLogged={onSetLogged} />
    </Card>
  )
}

// ─── Exercise picker modal ────────────────────────────────────────────────────

interface ExercisePickerProps {
  onPick: (exerciseId: number) => void
  onClose: () => void
}

function ExercisePicker({ onPick, onClose }: ExercisePickerProps) {
  const [search, setSearch] = useState('')
  const exercises = useLiveQuery(() => getAllExercises(), [])

  const filtered = exercises?.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col bg-slate-900/95 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="Pick an exercise"
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <input
          type="search"
          placeholder="Search exercises…"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 min-h-[44px]"
          aria-label="Search exercises"
        />
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>

      <ul className="flex-1 overflow-y-auto px-4 py-3 space-y-2" role="list">
        {filtered?.map((ex) => (
          <li key={ex.id}>
            <button
              onClick={() => onPick(ex.id!)}
              className="w-full text-left bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 hover:border-indigo-500 transition-colors active:opacity-80 min-h-[56px]"
            >
              <p className="text-sm font-medium text-slate-200">{ex.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {ex.equipment} · {ex.muscleGroup}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function WorkoutSession() {
  const { activeWorkoutId, isActive, end } = useWorkoutSession()
  const { weightUnit } = useSettingsStore()
  const navigate = useNavigate()
  const [showPicker, setShowPicker] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const workout = useLiveQuery(
    () => (activeWorkoutId ? getWorkoutWithEntries(activeWorkoutId) : undefined),
    [activeWorkoutId, refreshKey]
  )

  if (!isActive || !activeWorkoutId) {
    return (
      <>
        <TopBar title="Workout" />
        <PageContainer className="flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-slate-500 text-center">No active workout.</p>
          <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
        </PageContainer>
      </>
    )
  }

  const handleAddExercise = async (exerciseId: number) => {
    await addExerciseToWorkout(activeWorkoutId, exerciseId)
    setShowPicker(false)
    setRefreshKey((k) => k + 1)
  }

  const handleEndWorkout = async () => {
    await end()
    navigate('/')
  }

  const refresh = () => setRefreshKey((k) => k + 1)

  return (
    <>
      <TopBar
        title="Active Workout"
        right={
          <Button variant="danger" size="sm" onClick={handleEndWorkout}>
            End
          </Button>
        }
      />
      <PageContainer className="px-4 py-4 space-y-3">
        {workout?.entries.length === 0 && (
          <p className="text-center text-slate-600 text-sm py-8">
            Add your first exercise below.
          </p>
        )}

        {workout?.entries.map((entry) => (
          <ExerciseCard
            key={entry.id}
            entry={entry}
            weightUnit={weightUnit}
            onSetLogged={refresh}
          />
        ))}

        <Button
          variant="secondary"
          fullWidth
          onClick={() => setShowPicker(true)}
          aria-label="Add exercise"
        >
          + Add exercise
        </Button>
      </PageContainer>

      {showPicker && (
        <ExercisePicker
          onPick={handleAddExercise}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
