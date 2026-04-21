# fit-elite — Product Roadmap & Feature Ideas

> Living document. Update as phases complete and priorities shift.
> Last updated: 2026-04-21

---

## Vision

A PWA fitness tracker that feels faster and more private than any native app.
No account required, no subscription, no network dependency. Works on any device,
installs from the browser, syncs to the cloud only when the user explicitly opts in.

---

## Phase 1 — Core Offline Tracker (MVP)

**Goal:** A fully functional workout logger that works 100% offline.
**Done when:** A user can complete a full training week without touching a network toggle.

### Session Management
- [ ] Start a workout session (creates a `Workout` record with `startedAt`)
- [ ] Pause / resume a session (track paused intervals, subtract from duration)
- [ ] End a session (`endedAt` saved, session count incremented)
- [ ] Auto-resume: if the app was closed mid-session, detect and offer to continue
- [ ] Session notes: free-text field on the `Workout` record

### Exercise Library
- [x] Seed 34 default exercises across 8 muscle groups (done in demo kit)
- [ ] Per-exercise detail screen: instructions, primary muscle, equipment
- [ ] "Favourites" — pin exercises to the top of the picker
- [ ] Recently used — show the last 5 exercises at the top of the picker
- [ ] Muscle group icons / illustrations on exercise cards

### Set Logging
- [x] Log reps + weight per set with `SetType` (warmup / working / dropset / failure)
- [ ] kg / lbs toggle that converts all displayed weights immediately
- [ ] Quick-fill: pre-populate the set form with the previous set's values
- [ ] Rest timer: countdown starts automatically after each completed set
  - Configurable rest duration per exercise (default from settings)
  - Audible beep + haptic feedback when rest ends (Vibration API)
  - ARIA live region announces countdown for screen readers
- [ ] Notes per set (optional, collapsible input)
- [ ] Swipe-to-delete on set rows (with undo toast)
- [ ] Reorder exercises within a session (drag handle)

### Workout History
- [ ] List view: date, duration, total volume, exercise count
- [ ] Calendar view: heat-map of workout days (colour intensity = volume)
- [ ] Session detail: all exercises and sets, total volume, duration, notes
- [ ] Filter history by muscle group or exercise
- [ ] Delete a past workout (with confirmation dialog)

### Personal Records (PR)
- [ ] Auto-detect a new PR after each set is logged (compare weight × reps)
- [ ] PR badge (`🏆`) displayed inline on set rows when a PR is beaten
- [ ] PR history screen: all-time bests per exercise, grouped by rep count
- [ ] Notification toast: "New PR — Bench Press 100 kg × 5 reps!"

### Basic Stats (Dashboard)
- [x] Weekly workout count (done in demo kit)
- [x] All-time completed workout count (done in demo kit)
- [ ] Weekly volume (kg / lbs total)
- [ ] Current streak (consecutive weeks with ≥ 1 workout)
- [ ] Longest streak ever
- [ ] Most trained muscle group this month

### PWA & Install
- [x] Valid web app manifest with icons (defined in vite.config.ts)
- [x] Service worker via Workbox (vite-plugin-pwa)
- [x] Capture `beforeinstallprompt` event (done in App.tsx)
- [ ] Show install banner after user completes their **3rd session**
- [ ] "Add to Home Screen" step-by-step guide for iOS Safari (no install prompt API)
- [ ] Offline indicator in TopBar (already wired, needs visual polish)
- [ ] SW update toast: "New version available — tap to update"

---

## Phase 2 — Enhanced Experience

**Goal:** Delight power users. Richer logging, templates, charts, quality-of-life improvements.
**Prerequisite:** Phase 1 complete and stable (all items above checked).

### Custom Exercises
- [ ] Create custom exercise: name, muscle group, equipment, optional instructions
- [ ] Edit / delete custom exercises
- [ ] Custom exercise badge on exercise cards
- [ ] Import exercises from a JSON file (for power users migrating from other apps)

### Workout Templates
- [ ] Create a template from any completed workout
- [ ] Built-in starter templates:
  - Push / Pull / Legs (6-day)
  - Starting Strength (3×5)
  - Upper / Lower split
  - Full-body beginner (3-day)
- [ ] Start a workout from a template (pre-populates exercises and set targets)
- [ ] Edit templates: reorder, add/remove exercises, change set targets
- [ ] "Smart suggest": recommend a template based on last session's muscle groups (avoid consecutive same-muscle sessions)

### Progress Charts
- [ ] Volume over time per exercise (line chart, last 90 days)
- [ ] 1RM estimate trend: uses Epley formula `w × (1 + r / 30)`
- [ ] Weekly volume by muscle group (stacked bar chart)
- [ ] All charts work fully offline (render from IndexedDB data)
- [ ] Date range selector: 30 / 90 / 180 days / all time

### Body Metrics
- [ ] Log body weight with date
- [ ] Body weight chart (line graph)
- [ ] Optional body measurements: chest, waist, hips, arms, thighs
- [ ] Measurements history list

### Rest Timer Enhancements
- [ ] Push notification when rest ends (Notification API, requires permission)
  - Request permission on first rest timer start
  - Fall back to in-app vibration if permission denied
- [ ] Per-exercise rest override (override the global setting)
- [ ] Skip rest button
- [ ] Add 30 seconds button

### Dark / Light Mode
- [ ] Toggle in Settings
- [ ] Respect `prefers-color-scheme` on first visit
- [ ] Smooth CSS transition between themes
- [ ] Theme persisted in `settingsStore`

### UX & Accessibility Polish
- [ ] Onboarding flow: 3-screen swipeable intro on first launch
- [ ] Empty states with illustration and CTA for every page
- [ ] Skeleton loaders on all `useLiveQuery` calls (replace `undefined` flash)
- [ ] Toast / snackbar system for success and error feedback
- [ ] Keyboard navigation audit (all modals trap focus, Escape closes)
- [ ] Increase touch target audit — all interactive elements ≥ 44 × 44 px
- [ ] Reduce motion: respect `prefers-reduced-motion` for all animations

### Sharing
- [ ] Share a completed workout summary via Web Share API
- [ ] Generate a shareable image card (workout name, exercises, volume) using Canvas API

---

## Phase 3 — Online Sync

**Goal:** Optional cloud backup and multi-device sync. The app must remain 100% functional with sync disabled.
**Prerequisite:** Phase 2 complete and stable.

### Authentication (Supabase Auth)
- [ ] Sign up / sign in with email + password
- [ ] Magic link login (passwordless)
- [ ] Google / Apple OAuth
- [ ] Account deletion (GDPR compliance — purge all cloud data)
- [ ] Auth state persisted locally; auto-refresh tokens without user interaction

### Cloud Sync
- [ ] On first sign-in: upload all existing local IndexedDB data to Supabase
- [ ] Incremental sync: push local changes when online, queue when offline
  - Use Background Sync API (`workout-sync-queue` tag)
  - Retry with exponential backoff (2 s, 4 s, 8 s … max 5 retries)
- [ ] Conflict resolution: **last-write-wins at the `Set` level** (by `createdAt`)
- [ ] Sync status indicator: synced ✓ / pending ⏳ / error ✗
- [ ] Manual "Sync now" button in Settings

### Multi-device
- [ ] Sign in on a second device — all data appears immediately
- [ ] Real-time sync via Supabase Realtime subscriptions (optional, progressive enhancement)
- [ ] Device list in Settings: see which devices have synced

### Export / Import
- [ ] Export all data to JSON (full fidelity, re-importable)
- [ ] Export workout history to CSV (Excel-friendly)
- [ ] Import from JSON backup
- [ ] Import from other apps (research popular formats: Strong, Hevy, FitNotes)

---

## Stretch Ideas (Unscheduled)

These are ideas that don't fit neatly into a phase yet. Revisit after Phase 2.

### AI / Smart Features
- [ ] AI workout suggestion: "You haven't trained legs in 5 days — here's a session"
- [ ] Form tips: link YouTube tutorial for each exercise
- [ ] Auto-detect plateau: alert when 1RM estimate hasn't improved in 4 weeks

### Social
- [ ] Friends feed: opt-in sharing of workout completions
- [ ] Workout challenges: compete with a friend on weekly volume
- [ ] Public profile with aggregate stats (no individual set data shared by default)

### Wearables & Health APIs
- [ ] Export workouts to Apple Health / Google Fit
- [ ] Import resting heart rate data from Health APIs to correlate with recovery
- [ ] Smartwatch companion: log sets from wrist (Web Bluetooth API, experimental)

### Gamification
- [ ] Achievements / badges: "First 100 kg lift", "30-day streak", "10,000 kg volume week"
- [ ] Level system based on total lifetime volume
- [ ] Weekly challenges: "Do 5 sets of pull-ups this week"

### Monetisation (if ever needed)
- [ ] Phase 1–2: permanently free, no account required
- [ ] Phase 3 sync: free tier (1 device, 90-day history) / Pro tier (unlimited)
- [ ] One-time purchase option (no recurring subscription)

---

## Known Technical Debt & Backlog

| Item | Priority | Notes |
|------|----------|-------|
| History detail page (`/history/:id`) | High | Route exists, page not implemented |
| PR detection hook | High | Logic stub needed in `workout.queries.ts` |
| Pause/resume session state | Medium | `workoutSessionStore` tracks ID only |
| `useLiveQuery` undefined flash | Medium | Add skeleton loaders to all pages |
| Icon assets | Medium | `public/icons/` directory empty — need 192, 512, maskable PNGs |
| Vitest test suite | Medium | No tests written yet; start with `detectPR` util |
| Playwright E2E suite | Medium | Add offline smoke test as first E2E |
| `formatDuration` util | Low | Duplicated in Dashboard + History — extract to `src/utils/` |
| `formatDate` util | Low | Same — extract to `src/utils/dateHelpers.ts` |
| Settings page | Low | No UI yet; only store exists |
| Error boundary | Low | Wrap routes in an `<ErrorBoundary>` |

---

## Implementation Order (next session)

When picking up work, follow this priority order:

1. **History detail page** — users need to see a completed workout's sets
2. **PR detection** — core Phase 1 feature, currently absent
3. **PWA install banner** — show after 3rd session (logic in `settingsStore`)
4. **Icon assets** — required for Lighthouse PWA score = 100
5. **Extract `formatDuration` / `formatDate`** to `src/utils/`
6. **Vitest: `detectPR` unit tests** — first test coverage
7. **Skeleton loaders** — polish the `useLiveQuery` loading states
8. **Settings page** — kg/lbs toggle, rest timer default, theme

---

*To add a new idea: append to the relevant phase or Stretch section.
Do not start Phase 2 work until all Phase 1 checkboxes are ticked.*
