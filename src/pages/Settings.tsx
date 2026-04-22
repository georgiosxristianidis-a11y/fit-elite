import { TopBar } from '@/components/layout/TopBar'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { useSettingsStore } from '@/store/settingsStore'
import type { WeightUnit } from '@/types/workout.types'

const WEIGHT_UNITS: { value: WeightUnit; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'lbs', label: 'lbs' },
]

export function Settings() {
  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const restTimerSeconds = useSettingsStore((s) => s.restTimerSeconds)
  const setWeightUnit = useSettingsStore((s) => s.setWeightUnit)
  const setRestTimerSeconds = useSettingsStore((s) => s.setRestTimerSeconds)

  return (
    <>
      <TopBar title="Settings" />
      <PageContainer className="px-4 py-4 space-y-4">
        {/* Weight Unit */}
        <Card>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Units</h2>
          <div className="flex gap-3">
            {WEIGHT_UNITS.map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center gap-2 cursor-pointer min-h-[44px] flex-1"
              >
                <input
                  type="radio"
                  name="weightUnit"
                  value={value}
                  checked={weightUnit === value}
                  onChange={() => setWeightUnit(value)}
                  className="accent-indigo-500 w-4 h-4"
                />
                <span className="text-sm text-slate-200">{label}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* Rest Timer */}
        <Card>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Rest timer</h2>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={30}
              max={300}
              step={5}
              value={restTimerSeconds}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val) && val >= 30 && val <= 300) {
                  setRestTimerSeconds(val)
                }
              }}
              className="w-24 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 text-center focus:outline-none focus:border-indigo-500 min-h-[44px]"
              aria-label="Rest timer duration in seconds"
              inputMode="numeric"
            />
            <span className="text-sm text-slate-400">{restTimerSeconds} seconds</span>
          </div>
        </Card>

        {/* About */}
        <Card>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">About</h2>
          <dl className="space-y-2">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-slate-500">Version</dt>
              <dd className="text-sm text-slate-300">0.1.0</dd>
            </div>
          </dl>
          <div className="mt-3 space-y-1">
            <p className="text-xs text-slate-500">All data is stored locally on this device.</p>
            <p className="text-xs text-slate-500">Works fully offline — no account required.</p>
          </div>
        </Card>
      </PageContainer>
    </>
  )
}
