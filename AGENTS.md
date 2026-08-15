# AGENTS.md

Project guide for coding agents working on **Scroll Unlock (ScrUlk)**, a
Firefox and Chrome Manifest V3 extension built with Preact, Vite, strict
TypeScript, `webextension-polyfill`, local extension storage, and IndexedDB.

## Owner-only context

`roadmap.md` is the owner's working document. Do not read, summarize, update,
or use it as implementation guidance unless the user explicitly asks you to.
Current behavior is defined by code, tests, and this file.

## Commands

Use npm; `package-lock.json` is the only dependency lockfile.

```sh
npm install
npm run check                 # lint, tests, Chrome build, Firefox debug build
npm run dev
npm run build
npm run build:firefox
npm run build:firefox-debug   # includes the dashboard Debug tab
```

## Where to start

- `src/background/index.ts`: service-worker entrypoint and synchronous browser
  event registration.
- `src/content/index.tsx` and `src/content/Root.tsx`: universal content-script
  bootstrap and feature composition.
- `src/features/access-flow/`: waiting, allowances, breaks, challenges,
  gateway interception, and their content UI.
- `src/features/tracking/`: tracked/all-sites segments, checkpoints, rollover,
  alarms, and the usage clock.
- `src/features/camera/`: camera model, typed WebRTC protocol, helper page,
  background lifecycle, and overlay.
- `src/features/peek/`: framing rule, preview overlay, and link lock.
- `src/shared/dayState.ts`: persisted wake-day state, defaults, phases, and
  derived-time helpers.
- `src/shared/settings.ts`: settings, defaults, and ownership classification.
- `src/shared/storage.ts`: the only direct `browser.storage.local` access.
- `src/shared/messages.ts`: typed UI/content-to-background commands.
- `manifest.config.ts`: authoritative permissions and extension entrypoints.

Tests live beside the behavior they cover. Prefer opening the relevant feature
directory and its composition entrypoint instead of searching every surface.

## Invariants

1. **The service worker is ephemeral.** Do not rely on background module state
   surviving. Persist durable state, use named `browser.alarms`, and register
   every event listener synchronously at module top level. Route event work
   through `runBackgroundTask`; its module state is only a transient mutex that
   prevents overlapping storage read-modify-write cycles.

2. **Tracking is event-driven.** Background code closes and opens timestamped
   segments; it never increments usage on an interval. UI derives live totals
   with the helpers in `shared/dayState.ts`. The one-shot checkpoint alarm
   exists only to exclude suspend/restart gaps.

3. **Wake-up time is the day boundary.** Usage, streaks, history, surveys, and
   rollover use the wake-day rather than midnight. Rollover finalizes segments
   at the boundary, not when a delayed alarm happens to run.

4. **Domain matching is centralized.** Use `isTracked` and related helpers in
   `shared/domain.ts`; tracked domains match exactly or by subdomain.

5. **Storage access is centralized.** Read and subscribe through
   `shared/storage.ts`. Settings changes use `setSettings`. Production
   `DayState` changes originate in the background; UI and content scripts send
   commands. Lint rules enforce the important boundaries.

6. **State and commands use different channels.** Background state changes are
   observed through `storage.onChanged`. Imperative requests use
   `sendCommand`; adding a command requires an exhaustive background handler.

7. **The content script is universal.** Keep one static `<all_urls>` content
   script. The top-level Shadow DOM root is mounted on every page because some
   features are universal. `Root.tsx` decides which feature UI renders.

8. **Subframes are exceptional.** Ordinary subframes bail immediately. Only
   the named Peek frame installs the link lock. Peek frames bypass access flow,
   surveys, tab limits, overlays, and tracked usage.

9. **Shadow CSS cannot style the document.** Page-wide behavior must install
   document listeners or document-level styles with complete cleanup.

10. **Persisted deadlines require alarms.** Add alarm names to the canonical
    alarm registry and handlers to its exhaustive dispatcher. Reschedule from
    recomputation so browser restarts are safe.

11. **Navigation ordering matters.** Enforce extension snapshots and access
    rules before tab-limit handling. For concurrent removals, query live tabs
    rather than maintaining counters in module state.

12. **Display and internal names differ.** User-visible copy says “Scroll
    Unlock”; package and code identifiers use `scrulk`.

## Adding or changing state

- A `Settings` field needs a default and a deliberate entry in
  `SETTINGS_SCOPES`. Its owner determines whether it appears in normal
  settings, debug settings, internal logic, or a feature component.
- A `DayState` field needs a default. The Debug editor is exhaustively typed,
  and generic equality/normalization code must continue to cover new fields.
- Do not change the persisted shape merely to reorganize code. If a real
  schema change is required, add explicit normalization/migration tests.
- `usageStreak` is written only during wake-day rollover. The threshold is
  internal and must not be shown to users.

## Comments and documentation

Write comments for constraints and rationale that the code cannot express:
browser differences, privacy boundaries, timing semantics, and ordering
requirements. Do not leave edit history, commented-out code, file inventories,
or comments that merely narrate the next statement. Prefer types, registries,
tests, and composition code as executable documentation.

Only request browser permissions that current code uses. The manifest is the
single source of truth; explain non-obvious permission rationale beside it.
