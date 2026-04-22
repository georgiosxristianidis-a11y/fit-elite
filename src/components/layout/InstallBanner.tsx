import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSettingsStore } from '@/store/settingsStore'
import { db } from '@/db/schema'
import { Button } from '@/components/ui/Button'

export function InstallBanner() {
  const installPromptEvent = useSettingsStore((s) => s.installPromptEvent)
  const setInstallPromptEvent = useSettingsStore((s) => s.setInstallPromptEvent)
  const [dismissed, setDismissed] = useState(false)

  const sessionsCount = useLiveQuery(
    () => db.settings.toCollection().first().then((s) => s?.sessionsCount ?? 0),
    []
  )

  if (installPromptEvent === null || (sessionsCount ?? 0) < 3 || dismissed) {
    return null
  }

  const handleInstall = async () => {
    await installPromptEvent.prompt()
    const choice = await installPromptEvent.userChoice
    if (choice.outcome === 'accepted') {
      setInstallPromptEvent(null)
    }
    setDismissed(true)
  }

  return (
    <div
      className="fixed left-0 right-0 z-40 px-4"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      <div className="bg-indigo-600 text-white rounded-2xl mx-0 px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-xs truncate flex-1">
          Install fit-elite for offline access
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            className="bg-white text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 min-h-[44px]"
            onClick={handleInstall}
          >
            Install
          </Button>
          <button
            className="text-white/70 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss install banner"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
