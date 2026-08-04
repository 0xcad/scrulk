# CLAUDE.md

Project guide for LLM coding agents working on **Scroll Unlock (ScrUlk)**.

## What this is

A cross-browser (Firefox + Chrome) WebExtension that helps a user notice and
reduce time spent on websites they've flagged. The user maintains a list of
"tracked sites." On those sites the extension applies friction:

- a usage clock that ticks while a tracked site is focused,
- optional all-websites time tracking and an always-visible timer,
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
   plumb the input into `readActivity()`. The one-shot activity-check alarm
   is the sole exception: while a segment is open it refreshes
   `activityCheckpointAt` once a minute so laptop-sleep/browser-restart gaps
   can be excluded. It never increments usage directly.

   `dayState.allSitesMs` / `allSitesActiveSince` use the same model for
   focused, non-idle HTTP(S) pages. They are always collected, but never
   affect breaktime, gateway, tab-limit, or streak behavior. The
   `alwaysShowTimer` setting controls whether this value is shown.

   Day rollover finalizes open segments at the wake-day boundary, never at a
   delayed alarm or resume time. New-day segments begin only after the next
   activity recomputation confirms the user is active.

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
   `UsageClock` (tracked only unless `alwaysShowTimer` is enabled; tracked
   pages use their per-domain position and untracked pages use the global
   `allSitesClockPosition`), `SleepClock` (universal, self-hides
   outside the 10h window), `CameraOverlay` (tracked + enabled, fed by an
   extension-owned background helper tab), `BreaktimeOverlay` (tracked + flag). Later
   additions: `ResumeAfterSurveyOverlay`. `PeekOverlay` intercepts tracked
   links on untracked top-level pages; its named iframe installs only the
   imperative `ExtensionLinkLock`. When you add a new content
   feature, add a component under `src/content/` and conditionally
   render it from `Root.tsx`. Don't add a second content script.

## Peek previews

- `settings.peekEnabled` defaults to true. An unmodified primary click from an
  untracked top-level page to a tracked HTTP(S) link opens one Peek iframe;
  `target="_blank"` is included, while modifier clicks and downloads are not.
- The top-level URL stays untracked while Peek is open, so time accrues only to
  all-sites usage. Peek subframes must bypass gateways, breaktime, surveys,
  tab limits, tracked overlays, and tracked usage. `all_frames` is enabled only
  so the named `PEEK_FRAME_NAME` frame can install `ExtensionLinkLock`; every
  other subframe bails immediately.
- The arrow promotes the original Peek URL to a normal top-level navigation.
  Closing by X, backdrop, or Escape restores parent scrolling.
- `syncPeekFrameRule()` keeps the dynamic CSP/X-Frame-Options removal rule in
  sync on install, startup, and settings changes; disabling Peek removes it.
  Keep `installExtensionLinkLock()` safe for dynamic links and full cleanup.

## Breaktime implementation

- `src/background/breaktime.ts` owns breaktime transitions and durable
  alarms; `tracker.ts` only raises the normal usage-cadence alert.
- State flow: active → alert → (resume → active | done → survey | extension
  → alert). An extension is active time: tracking continues until its alarm
  expires or its original tracked tabs are all closed.
- Every persisted deadline needs a named `browser.alarms` alarm, registered
  in `background/index.ts` and re-scheduled by `recompute()`.
- All top-level URL changes are enforced in `tabs.onUpdated` in
  `background/index.ts`, before tab-limit enforcement. Persist temporary
  tab/page snapshots in `DayState`; never use module state. For concurrent
  tab-removal events, query live tabs instead of decrementing a counter.
- `Root.tsx` mounts document-wide behavior. Shadow-DOM CSS cannot style the
  host page; use a component with document listeners/a document-level style
  for page-wide interaction rules.

## DayState reference

`DayState` is persisted current-wake-day state. **Whenever adding, removing,
or changing a `DayState` field, update this list and `DEFAULT_DAY_STATE`.**

- `wakeDayStart`: start timestamp of the current wake-day.
- `totalMs` / `activeSince`: accumulated and open tracked-time segment.
- `allSitesMs` / `allSitesActiveSince`: equivalent segment for any HTTP(S)
  page; display-only.
- `activityCheckpointAt`: latest liveness confirmation for any open usage
  segment, or null when both segments are closed.
- `lastBreaktimeAt`: tracked total at the last successfully resolved alert.
- `breaktimeOpen`: a breaktime alert is currently blocking tracked pages.
- `breaktimeExtensionExpiresAt`: active one-time extension deadline, or null.
- `breaktimeExtensionUsed`: current alert cycle has consumed its extension.
- `breaktimeExtensionTabs`: original tracked page URL by eligible tab ID.
- `gatewayOpen`: an expired gateway overlay is pausing tracked time.
- `tabLimitWarning`: tab-limit rejection pending display in the popup.
- `surveyFilledFor`: wake-day key of the submitted survey, or null.
- `breaktimeShownToday`: this wake-day has shown at least one break alert.
- `surveyContinueAllowed`: post-survey tracked-site access has been approved.

## How to add a new setting

1. Extend the `Settings` interface in `src/shared/types.ts` and add a default
   to `DEFAULT_SETTINGS`.
2. Surface a control on `src/options/pages/Settings.tsx`. Group related
   settings under their own `<section>` with an `<h2>`.
   (Exception: computed/internal settings like `usageStreak`
   are written by the background and have no user-facing control.)
3. Anything that reacts to the setting subscribes via `onSettingsChange`.

## All-websites time

When `alwaysShowTimer` is on, the timer initially shows an unlabeled
all-websites total on every page. Clicking it toggles a two-line total/tracked
view (including a zero/non-incrementing tracked value on untracked pages);
the shared `alwaysShowTimerExpanded` setting keeps that choice synchronized
across page refreshes and tabs. Dragging still repositions it. The popup,
dashboard, calendar details, month stats, and survey expose all-sites time
only while the setting is on.
`DayRecord.allSitesMs` is optional so records created before this feature show
no inferred total.

## Streak counters

`settings.usageStreak` tracks consecutive days with at least 20 seconds of
tracked-site usage. It is **only ever written by `rolloverDay()`**
in `src/background/tracker.ts` — do not update them anywhere else.

- **Usage threshold:** `STREAK_THRESHOLD_MS` (20 000 ms) in
  `src/shared/types.ts`. Internal only — never show this number to the user.
- **Live streak formula:** `liveUsageStreakCount(settings.usageStreak, state, now)`
  — yesterday's completed count remains current until the day ends without
  qualifying use; it increments once today's tracked time reaches the threshold.
- **Calendar:** streaks are not persisted in `DayRecord` or displayed in the
  calendar.

## How to add a content-script overlay (slice 2+)

- The manifest registers one universal static content script. Add features as
  conditional components in `Root.tsx`; do not dynamically register another
  content script.
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

Current manifest permissions:

- `storage`: settings, day state, gateway state, and tab-back map.
- `tabs`: read URLs, update icons, create/close tabs, and enforce tab rules.
- `alarms`: wake-day reset, breaktime cadence/extension, and gateway timers.
- `idle`: pause usage tracking after inactivity.
- `webNavigation`: gateway navigation interception.
- `declarativeNetRequestWithHostAccess`: remove tracked-site framing headers
  for Peek preview iframes.
- Host permission `<all_urls>`: universal content script and tracked-page UI.

**When code needs a new browser or host permission, update
`manifest.config.ts` and this list in the same change; remove documentation
when a permission is removed.**
