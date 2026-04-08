import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { TopBar } from '@/components/layout/TopBar'
import { PageContainer } from '@/components/layout/PageContainer'
import { Badge } from '@/components/ui/Badge'
import { db } from '@/db/schema'
import type { MuscleGroup } from '@/types/workout.types'

const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'fullBody',
]

const muscleGroupLabel: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Cardio',
  fullBody: 'Full Body',
}

export function Exercises() {
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<MuscleGroup | null>(null)

  const exercises = useLiveQuery(() => {
    let query = db.exercises.orderBy('name')
    if (selectedGroup) {
      return db.exercises.where('muscleGroup').equals(selectedGroup).sortBy('name')
    }
    if (search.trim()) {
      const lower = search.toLowerCase()
      return query.filter((e) => e.name.toLowerCase().includes(lower)).toArray()
    }
    return query.toArray()
  }, [search, selectedGroup])

  return (
    <>
      <TopBar title="Exercises" />
      <PageContainer className="px-4 py-4 space-y-4">
        {/* Search */}
        <input
          type="search"
          placeholder="Search exercises…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setSelectedGroup(null)
          }}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 min-h-[44px]"
          aria-label="Search exercises"
        />

        {/* Muscle group filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          <button
            onClick={() => setSelectedGroup(null)}
            className={[
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors min-h-[32px]',
              selectedGroup === null
                ? 'bg-indigo-500 text-white border-indigo-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500',
            ].join(' ')}
          >
            All
          </button>
          {MUSCLE_GROUPS.map((group) => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group === selectedGroup ? null : group)}
              className={[
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors min-h-[32px]',
                selectedGroup === group
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500',
              ].join(' ')}
            >
              {muscleGroupLabel[group]}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <ul className="space-y-2" role="list" aria-label="Exercise list">
          {exercises?.map((ex) => (
            <li
              key={ex.id}
              className="flex items-center justify-between gap-3 bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{ex.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{ex.equipment}</p>
              </div>
              <Badge>{muscleGroupLabel[ex.muscleGroup]}</Badge>
            </li>
          ))}
        </ul>

        {exercises?.length === 0 && (
          <p className="text-center text-slate-600 text-sm py-8">No exercises found.</p>
        )}
      </PageContainer>
    </>
  )
}
