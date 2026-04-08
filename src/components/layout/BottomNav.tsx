import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: '⊞' },
  { to: '/workout', label: 'Workout', icon: '◎' },
  { to: '/history', label: 'History', icon: '≡' },
  { to: '/exercises', label: 'Exercises', icon: '✦' },
] as const

export function BottomNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 z-20"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex h-16" role="list">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center h-full gap-1',
                  'text-xs font-medium transition-colors min-w-[44px]',
                  isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300',
                ].join(' ')
              }
              aria-label={item.label}
            >
              <span className="text-xl leading-none" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
