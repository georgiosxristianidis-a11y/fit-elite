# CLAUDE.md — fit-elite

This file is the authoritative guide for AI assistants (and human contributors) working on this repository. Read it fully before starting any task.

---

## Project Overview

**fit-elite** is a Progressive Web App (PWA) fitness tracker with a hard offline-first requirement. Users can log workouts, track progress, and view history entirely without a network connection. The app is installable on mobile and desktop directly from the browser — no app store required, no subscription.

**Core constraints (non-negotiable):**
- Offline-first: every feature in Phase 1 must work without any network connection
- All data writes go to local IndexedDB first; the UI updates optimistically
- The app must never show a spinner or error state caused purely by a missing network connection in Phase 1
- PWA installability: valid manifest + service worker required from day one

---

## Technology Stack

| Tool | Role |
|------|------|
| React 18 + TypeScript | UI framework; TypeScript strict mode enforced |
| Vite + vite-plugin-pwa | Build tool; wraps Workbox for SW generation and manifest |
| Tailwind CSS v4 | Mobile-first utility styling |
| Dexie.js | IndexedDB wrapper; primary offline data store |
| Workbox (via vite-plugin-pwa) | Service worker caching strategies |
| Zustand | Lightweight state management with `persist` middleware |
| Vitest + React Testing Library | Unit and integration tests |
| Playwright | PWA-specific E2E tests (offline mode, install prompt, SW) |
| pnpm | Package manager |
| Supabase | **Phase 3 only** — cloud auth + sync backend |

**Why this stack:**
- Vite's `vite-plugin-pwa` is the cleanest path to Workbox integration; avoids manual service worker authoring
- Dexie.js is chosen over raw IndexedDB because it provides typed, promise-based queries and first-class migration support via `.version()`
- Zustand over Redux: no boilerplate, built-in `persist` middleware, small bundle footprint
- pnpm over npm/yarn: strict `node_modules` (no phantom deps), faster installs, disk-efficient

---

## Feature Phases

### Phase 1 — Core Offline Tracker (MVP)
All Phase 1 features must work with zero network connectivity.

- [ ] Workout session management: start, pause, end a session with timestamps
- [ ] Exercise library: predefined exercises with muscle group tagging
- [ ] Set logging: reps, weight (kg/lbs toggle), set type, rest timer, notes per set
- [ ] Workout history: list view, calendar view, session detail
- [ ] Personal record (PR) detection: auto-flag when a new weight/reps PR is set for an exercise
- [ ] Basic stats: weekly volume, total workouts this month, current streak
- [ ] PWA install prompt: capture `beforeinstallprompt`, show after user's 3rd session

### Phase 2 — Enhanced Experience
Begin only after Phase 1 is stable and complete.

- [ ] Custom exercise creation
- [ ] Workout templates (Push/Pull/Legs, Starting Strength, etc.)
- [ ] Progress charts: weight lifted over time, body measurements
- [ ] Body weight tracking
- [ ] Rest timer with push notification (Notification API)
- [ ] Dark / light mode toggle

### Phase 3 — Online Sync
Begin only after Phase 2 is stable. Supabase dependency introduced here.

- [ ] User authentication (Supabase Auth)
- [ ] Cloud backup and sync of all IndexedDB data
- [ ] Multi-device sync with conflict resolution (last-write-wins at `Set` level)
- [ ] Export to CSV / JSON

---

## Domain Vocabulary

Use these terms precisely and consistently across types, variable names, comments, and UI strings.

| Term | Definition |
|------|------------|
| `Workout` | A single session with `startedAt` / `endedAt` timestamps, containing one or more `ExerciseEntry` items |
| `ExerciseEntry` | A specific exercise performed within a `Workout`; contains one or more `Set` items and an `exerciseId` reference |
| `Exercise` | A reusable definition in the exercise library: name, `muscleGroup`, equipment, instructions. Not the act of performing it. |
| `Set` | A single unit of work within an `ExerciseEntry`: reps, weight, `setType`, `completed` boolean |
| `PR` | Personal Record — the maximum weight lifted for a given rep count on a given `Exercise` |
| `MuscleGroup` | `'chest' \| 'back' \| 'shoulders' \| 'arms' \| 'legs' \| 'core' \| 'cardio' \| 'fullBody'` |
| `SetType` | `'warmup' \| 'working' \| 'dropset' \| 'failure'` |

---

## Directory Structure

```
fit-elite/
├── public/
│   ├── icons/                  # PWA icons: 192x192, 512x512, maskable variant
│   └── screenshots/            # PWA store screenshots (optional)
├── src/
│   ├── assets/                 # Fonts, static images
│   ├── components/
│   │   ├── ui/                 # Primitives: Button, Input, Modal, Card, Badge
│   │   ├── workout/            # WorkoutCard, SetRow, ExerciseList, RestTimer
│   │   ├── history/            # HistoryList, WorkoutDetail, CalendarView
│   │   ├── progress/           # StatsCard, PRBadge, VolumeChart
│   │   └── layout/             # BottomNav, TopBar, PageContainer
│   ├── db/
│   │   ├── schema.ts           # Dexie DB class, table definitions, all migrations
│   │   └── queries/            # workout.queries.ts, exercise.queries.ts, pr.queries.ts
│   ├── hooks/                  # useWorkoutSession, useExercises, useTimer, useOnlineStatus
│   ├── pages/                  # Dashboard, WorkoutSession, History, Exercises, Progress, Settings
│   ├── store/                  # workoutSessionStore.ts, settingsStore.ts (Zustand)
│   ├── types/                  # workout.types.ts, exercise.types.ts, db.types.ts
│   ├── utils/                  # formatDuration, calculateVolume, detectPR, dateHelpers
│   ├── service-worker/         # Custom SW extensions (push notifications, background sync)
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── unit/                   # Vitest tests mirroring src/ structure
│   ├── integration/            # Hook and store integration tests
│   └── e2e/                    # Playwright tests (offline mode, install prompt, SW lifecycle)
├── .github/
│   └── workflows/              # test.yml, deploy.yml
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── CLAUDE.md
└── README.md
```

---

## Development Commands

```bash
pnpm install          # Install all dependencies

pnpm dev              # Start dev server at http://localhost:5173
                      # NOTE: service worker is NOT active in dev mode
                      # Use build + preview to test actual PWA behavior

pnpm build            # Production build (outputs to dist/)
pnpm preview          # Serve the production build — test SW, offline, install here

pnpm test             # Vitest in watch mode (unit + integration)
pnpm test:run         # Vitest single run (CI mode)
pnpm test:e2e         # Playwright E2E tests
pnpm test:e2e:ui      # Playwright interactive UI

pnpm lint             # ESLint
pnpm lint:fix         # ESLint with auto-fix
pnpm typecheck        # tsc --noEmit (run before committing)
pnpm format           # Prettier
```

**Important:** PWA features (service worker registration, offline caching, install prompt) are **not active** during `pnpm dev`. Always use `pnpm build && pnpm preview` to test PWA-specific behavior.

---

## PWA Rules

### Web App Manifest
- `display: "standalone"` — hides browser chrome when installed
- `start_url: "/?source=pwa"` — enables analytics to distinguish installed vs browser usage
- `theme_color` and `background_color` must match the app's primary palette
- Required icons: `192x192` (standard), `512x512` (splash screen), maskable variant for Android adaptive icons
- `screenshots` array recommended for richer install prompts on Android

### Service Worker Caching Strategies
| Resource Type | Strategy | Rationale |
|---------------|----------|-----------|
| JS / CSS / fonts | `CacheFirst` with versioned cache name | Static; bust on new build |
| Exercise library data | `StaleWhileRevalidate` | Acceptable to show slightly stale definitions |
| API calls (Phase 3 Supabase) | `NetworkFirst`, 3s timeout → cache fallback | Fresh preferred; cached acceptable |
| Auth tokens / write operations | **Never cache** | Security; stale writes corrupt data |

### Offline-First Rules (enforced for Phase 1)
1. All writes go to IndexedDB first; never wait for a network response to update the UI
2. Every data-fetching hook must handle `isOffline` without throwing or showing an error state
3. No Phase 1 feature may be gated behind a network check
4. Use the `useOnlineStatus` hook to surface connectivity state in the UI — not to gate functionality

### Install Prompt Behavior
- Capture the `beforeinstallprompt` event in a Zustand store action immediately on page load
- Do **not** show the install banner on first visit — trigger it after the user completes their 3rd workout session
- Never call `prompt()` without a user gesture (button click)

---

## Coding Conventions

### TypeScript
- Strict mode enabled: `"strict": true` in `tsconfig.json`
- No `any` — use `unknown` with type guards or define proper interfaces
- Prefer `interface` for object shapes; use `type` for unions, intersections, and aliases
- All Dexie table row types must have a corresponding TypeScript interface in `src/types/`
- Exported types live in `src/types/`; component-local types may be co-located

### React
- Functional components only — no class components
- Custom hooks for all non-trivial stateful logic: if a component has more than 2 related `useState` calls, extract a hook
- Avoid prop drilling beyond 2 levels — use a Zustand store or React Context
- Keep components focused: UI rendering only; data access goes in hooks

### Database (Dexie / IndexedDB)
- **All** schema changes must use Dexie's `.version(n).stores({})` migration API — never manually drop/recreate tables
- The single source of truth for the database schema is `src/db/schema.ts`
- Components and pages **must not** import from `src/db/schema.ts` directly — only from `src/db/queries/`
- Query functions return typed results using the interfaces from `src/types/`

### State Management (Zustand)
- One store file per domain: `workoutSessionStore.ts`, `settingsStore.ts`
- Use `immer` middleware for stores with nested state updates
- Use `persist` middleware only for data that must survive a hard refresh (settings, active session draft)
- Do not put derived/computed values in the store — compute them with selectors or `useMemo`

### Styling (Tailwind CSS)
- Mobile-first breakpoints: default styles target mobile; use `sm:`, `md:`, `lg:` to scale up
- Use `@apply` sparingly — only for genuinely reusable patterns like `.btn-primary`
- No inline `style` prop for static values; use Tailwind classes
- Inline `style` is acceptable only for truly dynamic values (e.g., chart dimensions computed at runtime)
- Touch targets: minimum `44×44px` for all interactive elements (Tailwind: `min-h-[44px] min-w-[44px]`)

### File Naming
| Type | Convention | Example |
|------|-----------|---------|
| React component | `PascalCase.tsx` | `WorkoutCard.tsx` |
| Custom hook | `useCamelCase.ts` | `useWorkoutSession.ts` |
| Utility function | `camelCase.ts` | `calculateVolume.ts` |
| Type definitions | `camelCase.types.ts` | `workout.types.ts` |
| Zustand store | `camelCaseStore.ts` | `workoutSessionStore.ts` |
| Query module | `camelCase.queries.ts` | `workout.queries.ts` |
| Test file | mirrors source with `.test.ts(x)` | `WorkoutCard.test.tsx` |

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat(workout): add rest timer with haptic feedback
fix(db): correct PR detection when reps match exactly
chore(deps): upgrade dexie to 4.0.1
refactor(hooks): extract useTimer from WorkoutSession page
test(e2e): add offline mode smoke test for logging a set
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`

---

## Git Workflow

### Branch Naming
```
feat/short-description       # New features
fix/short-description        # Bug fixes
chore/short-description      # Tooling, dependencies, config
docs/short-description       # Documentation only
refactor/short-description   # Code restructuring, no behavior change
```

### Branch Protection
- `main` is always deployable — never commit broken code to main
- All changes go through pull requests — no direct commits to `main`
- Squash-merge PRs to keep the main history linear and readable
- PR title follows Conventional Commits format

---

## AI Assistant Guide

### Before Starting Any Task
1. Read this entire CLAUDE.md
2. Check `src/types/` before creating new interfaces — extend existing ones when appropriate
3. Understand which phase the task belongs to; do not introduce Phase 2/3 patterns into Phase 1 work

### Implementation Order
When adding a new feature, follow this order:
1. Add/update types in `src/types/`
2. Update database schema in `src/db/schema.ts` (add a new `.version()` if schema changes)
3. Add query functions in `src/db/queries/`
4. Create or update hooks in `src/hooks/`
5. Build UI components in `src/components/` or pages in `src/pages/`

### DO
- Use the domain vocabulary from this file exactly as defined — consistent naming across types, variables, UI strings
- Keep offline-first constraints in mind for every data access pattern
- Use `useOnlineStatus` when surfacing connectivity state — never to gate Phase 1 features
- Run `pnpm typecheck && pnpm lint` before declaring a task complete
- Add Playwright tests for any new PWA-specific behavior (install prompt, offline fallback, SW update)

### DON'T
- Use `localStorage` directly — always go through Dexie via `src/db/queries/`
- Import from `src/db/schema.ts` in components or pages — only from `src/db/queries/`
- Make `fetch()` calls directly in components — use dedicated hook or service modules
- Add a `console.log` without a `// TODO: remove` comment
- Install a new dependency without noting the rationale in the PR description
- Introduce network-dependent behavior into Phase 1 features
- Hardcode user-visible strings — write them in a way that allows i18n extraction later (even if i18n is not yet implemented)

### When Uncertain
- Default to the simplest implementation that satisfies the offline-first constraint
- Prefer extending an existing hook over creating a new one
- Prefer Tailwind utility classes over new CSS files
- Prefer TypeScript type narrowing (`if ('field' in obj)`) over type assertions (`as Type`)
- Flag a design issue rather than silently adding network dependencies to Phase 1

---

## Performance and Accessibility Targets

| Target | Threshold |
|--------|-----------|
| Lighthouse PWA score | 100 |
| Lighthouse Performance (mobile) | 90+ (Moto G4 throttling profile) |
| First Contentful Paint | < 1.5s on 3G |
| Time to Interactive | < 3.5s on 3G |
| Main JS bundle (gzipped) | < 150 KB |
| WCAG compliance | 2.1 AA minimum |
| Touch target size | ≥ 44×44px for all interactive elements |
| Color contrast (normal text) | ≥ 4.5:1 |
| ARIA live regions | Required for rest timer countdowns and workout-complete states |
