# Roadmap

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

i routinely come back to my closed laptop and find total timer is at like 4 hrs

camera on tracked pages: don't show immediately, show after, say, 10 minutes of use
* if tab is closed, click "connecting..." again to reopen camera window
* regression: it's broken?

needs an allowlist. for example, nytimes cooking.


Also: "Focus mode". 
* Log time in a separate timer (still increments total time, now increments focus time)
* can be enabled and disabled in extension popup
* extension has new icon when enabled
* idea: "focus mode" is a separate window? so you can have multiple "focus windows", where all tabs are focused.
    * in a focus window (or if focus mode is active), you can never use a tracked site. must use popups
    * idea: let user "stash" an entire window at once? you can name it, then resume a focus session later. what does this accomplish? declutters my computer (i have like 3 "project" firefox windows open at once), still provides alternatives to scrolling (work on a project instead), less likely to open a non-project website in a focus window if the window is absent until i'm working on something 
* hides the timer. do show the sleep timer.
* good idea! let user save tabs for later in focus mode (stash a tab). essentially like firefox "send tab to device". you send a tab out of focus mode, when you turn off focus mode you get it back later.
    * can stash a tab in the extension popup
* idea on calendar: show a pie chart for days. tracked time, focused time, unfocused time

## TODO:

* need to change icons ofc
* probably a bug with calendar day drawer *arrow to average* thing

another idea:
* limit clicks in addition to time. or, as the user approaches a breaktime limit, you should also bottleneck how many clicks they get to slow them down

Calendar probably needs more horizontal screen real estate, current look should only be on narrower screens...

==


* idea: dropdown caret on right of I'm done with tracked sites button to stop for 24 / 36 hrs?
 * idea: put a stop for 24 / 36 hrs button on the survey?

==

metrics idea: capture moving average of "outlier scrolling". my average right now is 11 mins per day, that seems suspiciously good, but I'm also trying to measure binge scrolling, which is less frequent. so maybe that's measuring a moving average of my top 5% outlier scroll sessions? another idea could also just be plotting a normal distribution of scrolling...
* how long was this binge scroll session compared to your last one? what about the ones before? what do your trendlines look like?

*wonderful* idea: A DNS, MITM proxy (with trusted root certificate) that just loads scroll unlock whenever you use it. must run a server then to store data in the backend. instead of browser extension pages, something like `scroll-unlock.local` could be used? or, best user-experience, the extension communicates with the locally running server. extension settings modify the server settings. if we get connection to the server (heartbeat), hide all shadow DOM and just let DNS injection handle everything.
* Value: If I want to get around this, i can just open a different browser, open a private browsing window, and I'm stopped. i never fuck with my DNS settings. Editing my hosts file is super inconvenient. Also, you can get it on multiple devices in sync for cheap

Idea:
* Show a waiting cursor instead of not-allowed on the "continue" button. a waiting cursor on the waiting page?

idea: increase unpredictability by randomly replacing clicked links with a camera popup and a question challenge?
* increase unpredictability by making the allowed time random +/- 1 min? so user doesn't know when they'll stop

add a secondary colored fullscreen button on peek preview 

idea: before starting a focus window, you have to type in "confirm" in some modal, that what you're doing matches a goal you set for yourself?

idea: just give me 15 mins on tracked websites to begin with (no waiting screen). only after that, must i see the waiting screen
    * problem: after 15 mins of scrolling i may be more likely (less rational) to just open a chrome window?
    * idea!: optional setting, default true, to always start tracked sites with a waiting screen. replace breaktime challenge with the waiting screen.
        * ensure that the interrupt screen shows the user their total time on the screen, clear as day...
        * configure both how long to wait before using a site, and how long to wait in between

TODO: focus mode timer flashes on load

hey, where are negative streaks shown? are they on the waiting confirm screen? still?

idea: a way to share your calendar view on a webserver, as an embed/iframe (works easy with DNS). it's like github's green squares, and it's public accountability

## Ideas I doubt I could personally implement, or perhaps could use

personal investment: something like an ascii garden that grows just by you having the extension enabled. "uptime" stops being just a number, has more emotional value. think john green sock buddy

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


Idea: gate the user based on previous behavior? allow user to set screentime goal. if user is below this goal, do not show waiting screens to them. give them a clear way where they can see if they go over time, they click a button ("accept"), and then lose no-waiting-screen privileges. make the conditions to go back to no-waiting screen very clear (like a probation).
* I don't think it is helpful to me actually, or matches my goals of finding other things to be doing with my time. could be helpful for others though

## ideas I've determined may be bad

idea: collect bullet points from user about what they want to be doing online *instead* of using tracked sites. show those in an accordion in the modal popup. occasionally, when user is scrolling, show these at random intervals to user one at a time
* if you let an app collect scope creep for long enough, eventually everything turns to a todo application

similar idea: a list of alternatives user has to click past? go for a short walk, call someone, tonic water, cigarette, drink. often i scroll when i'm feeling overworked and lack energy. what should i do instead?


idea: just make all tracked pages load 100ms slower or smtg?
* I personally always load shit in the background
