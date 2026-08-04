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

look into dimming the screen slowly for the last 30-60 seconds before you pull a person out of the app
* https://news.ycombinator.com/item?id=35888644 (csmeder)

if you're up 2 hrs before your wake up time, just don't show that clock

idea: optional setting (default off) -- show usage timer on *all* websites, and just have total daily usage. that's always visible. separate from time spent on tracked sites...
* something else must be broken about total time on all sites because it says I had 14 hrs yesterday (totally wrong)
* Also, want the "click to open pill" thing to be saved to state (if it's open, keep it open on other pages...)

if "time for a break" is shown, or "pause" (gateway.tsx)  do not increment total timer. pause that timer.

idea: on breaktime alert, gives you a +2 min extension. prevents you from opening new tracked tabs (idea is to let you get to a stopping point in whatever you're currently looking at). change the color of the timer


idea: glance-back esque, look at yourself while you hold
> Seeing herself through the eyes of the hidden video cameras that recorded her despair, she became acutely aware of herself as a subject in the world.

idea: on extended time view: do not show another timer. instead, add border/padding around the page, make it gray or smtg. add a timer there. "shrinking window".

idea on one-click view: replicate Arc's "peek" feature. Open tracked sites in a peek window, where you can't open up other tracked sites. also go back to my notes.md

idea: after ending a day (survey flow), make screen dim/grayscale if returning to tracked content / any site

"I'm done with tracked sites" button has to be visible even not on a tracked site

## TODO:

* i think there's a bug with the survey -> re-entry flow
* need to change icons ofc
* probably a bug with calendar day drawer *arrow to average* thing

another idea:
* limit clicks in addition to time. or, as the user approaches a breaktime limit, you should also bottleneck how many clicks they get to slow them down

Calendar probably needs more horizontal screen real estate, current look should only be on narrower screens...

Remove comments referencing slices and whatnot

==

ai generated code cleanup:
* after removing a website from a tracked page, remove its clockPositions from settings
* computation of the running average ms could be more efficient / "online", but whatever this is fine

==


* idea: dropdown caret on right of I'm done with tracked sites button to stop for 24 / 36 hrs?
 * idea: put a stop for 24 / 36 hrs button on the survey?

==

i routinely come back to my closed laptop and find total timer is at like 4 hrs

metrics idea: capture moving average of "outlier scrolling". my average right now is 11 mins per day, that seems suspiciously good, but I'm also trying to measure binge scrolling, which is less frequent. so maybe that's measuring a moving average of my top 5% outlier scroll sessions? another idea could also just be plotting a normal distribution of scrolling...
* how long was this binge scroll session compared to your last one? what about the ones before? what do your trendlines look like?

If I like camera on pause menu, keep it, but make the styling look nicer
If I dislike it, get rid of it (commit 149aaf61becbf377cb89f73879f0045f6165819b)
* codex resume 019fb5d7-5d24-7c22-9803-be04b224db47

camera on tracked pages: don't show immediately, show after, say, 10 minutes of use
* if tab is closed, click "connecting..." again to reopen camera window
* regression: it's broken?

*wonderful* idea: A DNS, MITM proxy (with trusted root certificate) that just loads scroll unlock whenever you use it. must run a server then to store data in the backend. instead of browser extension pages, something like `scroll-unlock.local` could be used? or, best user-experience, the extension communicates with the locally running server. extension settings modify the server settings. if we get connection to the server (heartbeat), hide all shadow DOM and just let DNS injection handle everything.
* Value: If I want to get around this, i can just open a different browser, open a private browsing window, and I'm stopped. i never fuck with my DNS settings. Editing my hosts file is super inconvenient. Also, you can get it on multiple devices in sync for cheap

## Ideas I doubt I could personally implement, or perhaps could use

idea: not really for me but for clearspace, really -- an iphone widget on the home screen. put it next to your social media apps. user can see their friend + partner's scrolling next to their own. idea: for people who don't have a partner to go to bed next to, essentially 

wouldn't it be crazy if I could someone detect, through pattern usage, when I would be more likely to start binge scrolling? it's a pretty regular pattern -- on days I work more, i am more likely to scroll longer. what would it look like for a system to:
* 1. Recognize when in my life I may be stressed, or prone to stress
    * Data input: journal entries. or some like a work trip scheduled on my calendar. google calendar to see if i'm taking late meetings? Something on my work computer that could tell how long I was working for? An integration with tsheets, where I clock out after finishing work? Historical usage? Maybe Thursdays I just see an uptick in time?
* 2. Literally just block access to my personal computer in those moments. I would not get the choice to re-enable that...
    * Could be configurable, instead of all access. Just tracked sites. All sites, but only allow 30 minutes total, of web surfing.

idea: what would it look like for a system to:
* recognize when my attention dwindled, even if not on a tracked site
    * data input: time spent on a page? rate of scrolling/scanning? rate of clicking through different material?
* alert me that this is potentially problematic usage?
one problem is that sometimes, "research" is scrolling/scanning. You gotta look around a lot to figure out if something is worth reading or not...
Could perhaps turn or turn off this setting? "Deep focus" mode or something, which I turn on only when I have a task I want to start (e.g, writing), and resources pulled up of something i want to do...
^For this, and predictive pre-commitment, I think to what a misinformation researcher told me at CMU. I really wondered how they could track the spread of misinformation so broadly across the internet. What does that look like at a technical level? This researcher said that misinfo has a "signature", essentially, unique properties in its virality, and they don't track when sources are wrong but *how sources spread* to determine if something is misinfo or not. Could be the same thing here...

## ideas I've determined may be bad

idea: collect bullet points from user about what they want to be doing online *instead* of using tracked sites. show those in an accordion in the modal popup. occasionally, when user is scrolling, show these at random intervals to user one at a time
* if you let an app collect scope creep for long enough, eventually everything turns to a todo application

similar idea: a list of alternatives user has to click past? go for a short walk, call someone, tonic water, cigarette, drink. often i scroll when i'm feeling overworked and lack energy. what should i do instead?


idea: just make all tracked pages load 100ms slower or smtg?
* I personally always load shit in the background
