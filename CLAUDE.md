# CLAUDE.md

Project guide for LLM coding agents working on **Scroll Unlock (ScrUlk)**.

## What this is

A cross-browser (Firefox + Chrome) WebExtension that helps a user notice and
reduce time spent on websites they've flagged. The user maintains a list of
"tracked sites." On those sites the extension applies friction:

- a usage clock that ticks while a tracked site is focused,
- a 30-min breaktime alert with a hold-to-continue challenge,
- a tab limit,
- a reflection survey + calendar history,
- a "sleep clock" countdown to wake-up time on every site.

Slice 1 (current) only ships the foundation: tracked-site CRUD, popup, per-tab
icon. The full slice plan lives in `roadmap.md`.

## Stack

- **Manifest V3.** Required for Chrome; supported by Firefox 115+.
- **Preact** + **Vite** + **`@crxjs/vite-plugin`** for HMR and a valid MV3 build.
- **TypeScript**, strict mode + `noUncheckedIndexedAccess`.
- **`webextension-polyfill`** so we always write `browser.*` and it works on
  both browsers.
- **`browser.storage.local`** for settings + day state. **IndexedDB** (via
  `idb`) for time-series history — added in slice 7.
- Plain CSS. Shadow DOM for content-script overlays in slice 2+.

## Layout

```
src/
  background/      MV3 service worker
    index.ts       entry; all listeners registered at top level
    icon.ts        per-tab icon switching
    tracker.ts     event-driven usage tracker + day-reset alarm
  content/         injected on every page; bails on non-tracked hosts
    index.tsx      mount/unmount controller
    UsageClock.tsx draggable Shadow-DOM overlay (slice 2)
  popup/           toolbar popup (Preact)
  options/         dashboard page (Preact, Home/Calendar/Settings tabs)
    pages/         one file per top-level page
    components/    shared widgets
  shared/
    types.ts       Settings, DayState, effectiveMs, defaults, keys, STREAK_THRESHOLD_MS
    storage.ts     getSettings / getDayState / on*Change subscriptions
    domain.ts      hostnameOf / normalizeDomain / isTracked / findMatchingDomain
    wakeDay.ts     currentWakeDayStart / nextWakeUpAt / formatDuration
  assets/          icons (active/inactive × 16/32/48/128)
manifest.config.ts ts-typed manifest, consumed by @crxjs at build time
```

## Invariants — read before coding

1. **Service worker is ephemeral.** No module-level state in `src/background/`.
   Persist via `browser.storage.local` and schedule via `browser.alarms`
   (slice 2+) — never `setTimeout` for anything that must outlive a few
   seconds. Register all event listeners synchronously at module top so the
   worker can be revived to handle them.

2. **All tracked-site matching goes through `isTracked`.** Never inline
   hostname comparison. The rule is: exact match OR subdomain match. Adding
   `example.com` matches `blog.example.com`. This is defined once in
   `src/shared/domain.ts`.

3. **All settings reads/writes go through `getSettings` / `setSettings`.**
   Don't touch `browser.storage.local` directly outside `shared/storage.ts`.
   This keeps the `Settings` type as the single source of truth and means
   `onSettingsChange` notifications stay correct.

4. **Day boundary = wake-up time.** The "day" runs from one wake-up time to
   the next. Anything time-bucketed (usage totals, survey rows) keys on the
   wake-day, not the calendar day. (Implemented in slice 2.)

5. **Display name vs. internal name.** User-visible strings say
   "Scroll Unlock". `package.json` and code identifiers use `scrulk`.

6. **Tracker is event-driven, never ticks.** `dayState.activeSince` is the
   moment the user became active+tracked. On every state change call
   `recompute()` in `src/background/tracker.ts` — it closes the open segment
   (`totalMs += now - activeSince`) and may open a new one. UI computes the
   live display via `effectiveMs(state, Date.now())`. **Do not** add a
   setInterval in the background. Adding new "is the user active?" inputs
   means: register a listener that calls `recompute()`, and (if needed)
   plumb the input into `readActivity()`.

7. **Content script is universal + reactive.** `src/content/index.tsx` runs
   on `<all_urls>`, bails fast when host isn't tracked, and (un)mounts on
   `storage.onChanged`. When you add a new content-script feature
   (slice 6 sleep clock; slice 4 breaktime overlay), add another component
   in `src/content/` and conditionally mount it from `index.tsx` — don't
   register a second content script.

8. **Background ↔ content sync via `storage.onChanged`.** No
   `runtime.sendMessage` for *state*. The background writes to storage; the
   content script's `onDayStateChange` / `onSettingsChange` subscriptions
   pick it up. This works even when the SW is asleep at the moment of
   subscription.

   `runtime.sendMessage` is reserved for *commands* the content script
   needs the background to execute on its behalf (close my tab, advance
   the breaktime cycle). Add new commands to `src/shared/messages.ts` —
   the union there is the single source of truth.

9. **Content-script root structure.** `src/content/index.tsx` is the
   mount controller. The Shadow-DOM root is mounted on **every** page
   (universal) because `SleepClock` is universal; `Root.tsx` decides per-
   feature what to render via `matchedDomain: string | null`. Currently:
   `UsageClock` (tracked only), `SleepClock` (universal, self-hides
   outside the 10h window), `BreaktimeOverlay` (tracked + flag). Later
   additions: `ResumeAfterSurveyOverlay`. When you add a new content
   feature, add a component under `src/content/` and conditionally
   render it from `Root.tsx`. Don't add a second content script.

## How to add a new setting

1. Extend the `Settings` interface in `src/shared/types.ts` and add a default
   to `DEFAULT_SETTINGS`.
2. Surface a control on `src/options/pages/Settings.tsx`. Group related
   settings under their own `<section>` with an `<h2>`.
   (Exception: computed/internal settings like `currentStreak`/`bestStreak`
   are written by the background and have no user-facing control.)
3. Anything that reacts to the setting subscribes via `onSettingsChange`.

## Streak counters

`settings.currentStreak` and `settings.bestStreak` track consecutive days with
near-zero tracked-site usage. They are **only ever written by `rolloverDay()`**
in `src/background/tracker.ts` — do not update them anywhere else.

- **Zero-usage threshold:** `STREAK_THRESHOLD_MS` (20 000 ms) in
  `src/shared/types.ts`. Internal only — never show this number to the user.
- **Live streak formula:** `settings.currentStreak + (effectiveMs(state, now) < STREAK_THRESHOLD_MS ? 1 : 0)`
  — yesterday's completed count plus today if it's still under the threshold.
- **Calendar:** `DayRecord.streak` is written by `rolloverDay()` when the
  outgoing day was a streak day. The calendar reads it directly; no full
  history scan is needed anywhere.

## How to add a content-script overlay (slice 2+)

- Register dynamically with `browser.scripting.registerContentScripts` from
  the background, filtered by the current tracked-site list. Re-register on
  `onSettingsChange`.
- Render with Preact into a Shadow DOM root attached to a top-level
  `<div id="scrulk-root">` element. Shadow DOM keeps host-page CSS out.
- Talk to the background via `browser.runtime.sendMessage` or
  `browser.storage.onChanged` rather than holding state in the content
  script.

## Build / load

```sh
npm install
npm run build      # → dist/
npm run dev        # HMR for popup + options; background reloads on save
npm test           # vitest (domain matching only in slice 1)
```

**Firefox**: open `about:debugging#/runtime/this-firefox` → *Load Temporary
Add-on* → pick `dist/manifest.json`.

**Chrome**: open `chrome://extensions` → enable Developer mode →
*Load unpacked* → pick `dist/`.

## Permissions philosophy

Only declare permissions the *current slice* uses. Each future slice's PR
adds the permissions it needs. The full eventual set is in `roadmap.md`.
