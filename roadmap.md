# Roadmap

Implementation roadmap for **Scroll Unlock (ScrUlk)**. Slices ship in order;
each is independently usable. Permissions and APIs called out per slice so the
next agent knows exactly what to add.

## Decided design answers (apply to all slices)

- **"Day" boundary** = wake-up time → next wake-up time. Usage at 2am with a
  7am wake-up counts toward the previous day's record.
- **Time accumulates** only when the tab is *focused + visible + system not
  idle*. Idle threshold ~60s.
- **Subdomain rule**: tracking `example.co.uk` also tracks `*.example.co.uk`.
  Suffix match, no Public Suffix List needed.
- **Hold-to-continue challenge**: releasing the button mid-hold *pauses* the
  hold timer; pressing again resumes from where it left off (held 3s, release,
  re-press needs 27s more). The 30s wait is one-shot.
- **Breaktime cadence**: counter resets after each successful "continue"
  challenge (so next alert is 30 min later, not 2 min later).
- **Tab-limit overflow**: close the *new* tab, not the oldest.
- **Sleep clock visibility window**: shows during `[wakeUp - 10h, wakeUp]`.
  Disappears automatically once wake-up time passes (it's then >10h before
  next wake-up).
- **Persistence**: all state survives browser restarts within the same day.
- **Missed-survey reminder**: in-extension only (badge dot on icon + banner
  in the popup/home page). No system notification permission needed.

## Permissions (full project)

Slice 1 manifest declares only the rows marked "Slice 1". Each later slice
adds what it needs.

| Permission | Purpose | Slice |
|---|---|---|
| `storage` | settings + day state | 1 |
| `tabs` | per-tab URL, change icon, close tabs | 1 |
| `alarms` | wake-up reset, breaktime intervals (service worker is ephemeral) | 2 |
| `idle` | pause usage clock when system idle | 2 |
| `host_permissions: <all_urls>` | one universal content script bails fast on non-tracked hosts; serves usage clock today, sleep clock later | 2 |
| `scripting` | (originally planned for slice 2) — deferred. The static `<all_urls>` content script handles dynamic tracked-list changes by reacting to `storage.onChanged` and mounting/unmounting itself, no dynamic registration needed | 4+ |
| `webNavigation` | (originally planned for slice 2) — not needed. Same-origin SPA nav doesn't change tracked status (tracking is per-domain). Cross-origin nav reloads the content script naturally | — |

---

## Slice 1 — Foundation ✅

Project scaffold (Vite + Preact + TS + crxjs + polyfill), MV3 manifest,
Settings storage shape, popup, options page shell with Home / Calendar /
Settings tabs, tracked-website CRUD, per-tab icon switching (active/inactive),
install-time recording.

## Slice 2 — Usage clock ✅

**Added permissions:** `alarms`, `idle`, `host_permissions: <all_urls>`.

Implementation notes (the actual shipped design, which differs slightly from
the original plan above):

- Tracker is **purely event-driven, no ticking**. `dayState` carries
  `{ wakeDayStart, totalMs, activeSince: number | null }`. On every
  state-changing event we run `recompute()` which closes the open segment
  (`totalMs += now - activeSince`) or opens a new one. The displayed value
  is computed live in the UI via `effectiveMs(state, now)`.
- Active = focused window + active tab + URL tracked + idle state `active`.
- Visibility ping was dropped: focused window + active tab is sufficient
  (window-focus-change fires when user tabs out of the browser entirely).
  Edge cases like Picture-in-Picture/side-panel-hidden remain a known
  limitation, not blocking.
- Content script is one static `<all_urls>` registration that bails fast on
  non-tracked hosts and remounts/unmounts on `storage.onChanged`. This
  avoids the `scripting` permission and dynamic registration entirely. It's
  also where the slice-7 sleep clock will live.
- Content script overlay renders into Shadow DOM (`#scrulk-root` host on
  `<html>`) with `pointer-events: none` on the host so the host page is
  unaffected; clock receives pointer events.
- Daily reset alarm (`scrulk:day-reset`) fires at `nextWakeUpAt(now,
  wakeUpHour)`. Alarm handler closes any open segment, zeroes totals, opens
  the next day, reschedules.
- Wake-up hour control landed on the Settings page now (originally slice 3)
  because slice 2 needs it user-configurable to test the day boundary.

## Slice 3 — Settings expansion + uptime ✅

- `breaktimeMinutes` (default 30) and `tabLimit` (default 3) on the Settings
  page, grouped under their own `<section>`s. Both live behind a generic
  `NumberField` component (`src/options/components/NumberField.tsx`) — bind
  to any numeric `Settings` field by name; commits on blur. Reuse it for
  future numeric settings.
- Home page shows uptime via `formatUptime` (just-now / minutes / hours /
  days, two units max) plus the calendar install date.
- (`wakeUpHour` shipped in slice 2.)
- Settings copy includes "ships in slice 4/5" hints next to controls whose
  enforcement isn't built yet, so the user knows the values are stored but
  not yet acted on.

## Slice 4 — Breaktime alerts + challenge ✅

Implementation notes:

- Trigger is **storage-driven, not message-driven**. Background flips
  `dayState.breaktimeOpen = true` when `effectiveMs - lastBreaktimeAt >=
  breaktimeMinutes * 60_000`. Content scripts on tracked tabs react via
  `onDayStateChange` and mount the overlay. Tab reload, tab switch, and
  multiple tracked tabs all just work — they observe the same flag.
- An alarm `scrulk:breaktime` is scheduled at the projected next-trigger
  time; it just calls `recompute()`, which is the single decision point.
  The alarm is cleared whenever no segment is open or an alert is already
  outstanding.
- Overlay state machine (`src/content/BreaktimeOverlay.tsx`):
  `alert → wait → hold → done`. Release during `hold` pauses the hold
  timer; pressing again resumes from where it left off. Wait is one-shot.
- "I'm done!" sends `breaktime:done` → background closes **all tracked-site
  tabs** (across all windows) via `tabs.remove`. `breaktimeOpen` stays true
  so any tracked tab the user reopens immediately re-mounts the overlay —
  only a successful hold (`breaktime:resume`) clears the flag. Survey flow
  lands in slice 6.
- Tracking pauses while `breaktimeOpen` is true (`shouldBeActive` short-
  circuits on it), so re-entry after "I'm done" lands on a paused clock.
- "Hold completed" sends `breaktime:resume` → background just resets the
  cycle. (No tab-close.)
- Multi-tab coverage: every tracked tab shows the overlay simultaneously
  (because they share `dayState.breaktimeOpen`). When any one resolves, all
  dismiss. This prevents "switch to another tracked tab to escape."
- New typed message channel in `src/shared/messages.ts`. Background never
  *pushes* state via messages — content scripts read `storage.onChanged`
  for that. Messages are reserved for *commands* the content script needs
  the background to execute (close tab, advance the cycle).

## Slice 5 — Tab limit ✅

- `tabs.onUpdated` (URL changes): count tabs across all windows whose host
  is tracked. If `count > settings.tabLimit`, close the just-changed tab.
  `onCreated` is unnecessary — fresh tabs have no URL yet, and the URL
  assignment fires `onUpdated` with `changeInfo.url`.
- Lives in `src/background/tabLimit.ts` and is wired into the existing
  `tabs.onUpdated` listener in `src/background/index.ts`.
- Reuses the `hostnameOf` + `isTracked` + `tabs.query({})` pattern from
  `handleBreaktimeDone` for counting.
- Popup warning is a `dayState.tabLimitWarning: boolean` flag, set true on
  any block. The popup reads it on mount, shows a one-line banner, and
  immediately writes the flag back to false. Resets at wake-day boundary.

## Slice 6 — Sleep clock ✅

- Universal content-script overlay (Shadow DOM) shown only in
  `[wakeUp - 10h, wakeUp]`. Counts down to wake-up time.
- Re-uses the slice-2 Shadow-DOM Preact-island pattern: lives in
  `src/content/SleepClock.tsx`, rendered unconditionally from
  `Root.tsx` (it self-hides outside the 10h window).
- Mount controller (`src/content/index.tsx`) now mounts on every page —
  not just tracked ones — since the sleep clock is universal. `Root.tsx`
  treats `matchedDomain: string | null`: `UsageClock` and
  `BreaktimeOverlay` only render when the page is tracked, `SleepClock`
  renders always.

## Slice 7 — Survey + calendar

- IndexedDB schema (`idb` wrapper):
  `days { date: 'YYYY-MM-DD' (wake-day), totalMs, regret: 1-5|null, notes: string|null }`.
- Survey modal triggered by "I'm done!" in the breaktime overlay (replaces
  the bare close from slice 4).
- Calendar widget on Home + Calendar pages (custom — no library). Days with
  data render with a heat color; days with notes show a small icon.
- Drawer on click: shows usage time, regret, notes; left/right buttons jump
  to the previous/next day with data; a trend icon shows whether the day
  raised or lowered the running average.
- Re-entry warning: if a tracked site is visited *after* the survey was
  filled out for the current wake-day, show a full-page overlay summarizing
  the survey response. Continue button resumes; "I'm done!" lets the user
  edit the survey.
- Missed-survey reminder: if wake-up passes without an "I'm done" (but a
  breaktime alert was shown), the popup and Home page show a banner
  prompting the user to fill out yesterday's survey. Badge dot on the
  toolbar icon.

## Slice 8 — Polish

- Survey page should show usage time for the day on it
- Bug: when the break time alert first appears, the count still does not pause. If the user exits the page, and opens it again, the count pauses. But not if the alert appears and the user stays on the page.
- TODO: Clicking a day on the calendar displays nothing. Should show survey data + free response if present in a drawer.
- Change behavior: If the survey has already been filled out for the day, when visiting a tracked page again, the tab should be closed, and the user should get redirected to their survey page. Only then, should the user see a "Continue" button in muted text below the survey response (hidden the first time survey appears). Clicking that should allow the user to go back to tracked pages and see the regular break alerts


- Home: "tracked sites count," "time on tracked sites since wake-up,"
  "average time on tracked sites" (running mean over recorded days).
- Drawer trend arrow (uses the running average from above).
- General visual cleanup once the feature set has settled.


## DONE:

Problem with first screen:
* the text box promotes alert fatigue -- I've noticed that if i have to type shit out to, "what do you want out of this?" after just using a site once to look something up quickly, I don't write anything meaningful and instead write how i'll spend that time instead ("just a minute to find X"). A better pattern would be, first screen is a "heads up", you're about to enter a tracked site. then perhaps automatically after, say, 5 minutes, you get hit with the second one
    * idea: first screen is heads up. you get three options, "continue for 2 minutes" "continue for 5 minutes", "continue for 10 minutes" (I'm thinking pills you can select). then, after that time is up, you get the alert with the textbox

* should be easier to change timezone on sleep timer. needs to be editable in extension popup then.

* uptime should reset if extension gets unloaded...

## TODO:


* i think there's a bug with the survey -> re-entry flow
* need to change icons ofc
* probably a bug with calendar day drawer *arrow to average* thing

another idea:
* limit clicks in addition to time. or, as the user approaches a breaktime limit, you should also bottleneck how many clicks they get to slow them down

definitely need streaks for no usage on calendar view, and to display that in popup

look into dimming the screen slowly for the last 30-60 seconds before you pull a person out of the app
* https://news.ycombinator.com/item?id=35888644 (csmeder)

I need some button to press on the extension itself to end a session and bring me to the survey

if you're up 2 hrs before your wake up time, just don't show that clock
