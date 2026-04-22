import { useLiveQuery } from 'dexie-react-hooks'
import { TopBar } from '@/components/layout/TopBar'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { getAllPRsWithExercises } from '@/db/queries/pr.queries'
import { useSettingsStore } from '@/store/settingsStore'
import { formatWeight } from '@/utils/weightHelpers'
import { formatFullDate } from '@/utils/dateHelpers'

export function Progress() {
  const { weightUnit } = useSettingsStore()
  const prs = useLiveQuery(() => getAllPRsWithExercises(), [])

  // Group PRs by exercise name
  const grouped = prs
    ? prs.reduce<Record<string, typeof prs>>((acc, pr) => {
        const key = pr.exerciseName
        if (!acc[key]) acc[key] = []
        acc[key].push(pr)
        return acc
      }, {})
    : null

  const exerciseNames = grouped ? Object.keys(grouped).sort() : []

  return (
    <>
      <TopBar title="Progress" />
      <PageContainer className="px-4 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Personal Records
        </h2>

        {prs === undefined && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-800 animate-pulse" />
            ))}
          </div>
        )}

        {prs?.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-slate-400 font-medium">No personal records yet.</p>
            <p className="text-slate-600 text-sm mt-1">
              Log a set to start tracking your bests.
            </p>
          </div>
        )}

        {exerciseNames.map((name) => (
          <Card key={name} className="space-y-2">
            <p className="font-semibold text-slate-200">{name}</p>
            <ul className="space-y-1.5" aria-label={`PRs for ${name}`}>
              {grouped![name].map((pr) => (
                <li
                  key={pr.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-400">
                    {pr.reps} rep{pr.reps !== 1 ? 's' : ''}
                  </span>
                  <span className="font-semibold text-indigo-300">
                    {formatWeight(pr.weight, weightUnit)}
                  </span>
                  <span className="text-slate-600 text-xs">
                    {formatFullDate(pr.achievedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </PageContainer>
    </>
  )
}
