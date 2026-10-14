# 35

A drop-and-merge number puzzle for iPhone, iPad and Android, and for the
browser. Plain HTML, CSS and JavaScript — no framework, no bundler — wrapped
for iOS and Android with Capacitor, with a small website that carries the
game.

## The game

A 6×6 board and one number in hand. You pick a column; the number falls to the
bottom. One rule:

> **Three of the same number, touching, become the next one up.**

Three 1s make a 2, three 2s make a 3, all the way up to 100. A merge starts at
the piece that arrived last — the one you dropped, or the one the merge before
made — and runs through the others to the far one, where the new number
appears. Whatever was above a merge falls into the gap, which can set off the
next merge — a chain, and each link pays more. Every full three that join
make one: four or five of a kind still make one of the next number, six make
two.

The hand deals three numbers — the best you have made and the two under it —
so the deal climbs with you all the way. The three come round in turn rather
than by the roll of a die: they go into a bag — the lowest four times, the
middle three, and the top once — and the hand is dealt from it until it is
empty, so none of them stays away for long, and the same number never comes
three times running. Once you make a 10 the seam starts to give way and pieces
fall in on their own, into columns you did not pick — more of them, and more
often, the higher you climb: one every five drops from 10, one every three
from 15, two every five from 20 to the end. The run ends when the board is
full.

**The bomb — the black 0.** The dial beside the hand fills with the merges
your moves make — twelve fill it — and keeps its charge if you leave mid-run.
When it is full, tap it and pick a column to drop a bomb. It joins nothing; a
merge beside it, or its own five-turn fuse, sets it off, and the eight squares
around it go with it. Infinity — a white diamond that fell in now and then and
swept a whole number off the board when set off — is out of the game; its
piece and its sweep are still in the code, switched off in
`js/core/config.js`.

**The column bomb — the black tile with a white arrow pointing up and down.** Once you make
a 10 it falls in with the seam, one every 50 drops. It joins nothing and
nothing sets it off early: its fuse burns for 5 turns, then it clears its
whole column, top to bottom — so whatever you stack on it while it burns
goes too. It never takes the 100; only the bomb you charge can.

**The 100 is the summit.** It wears the rainbow, and on the board the bomb
dial's light pulses round it: the thing to blow up. A blast that takes the
100 wins the run — the end card says so — and until then the run goes on,
with the 100 standing. Two records are kept: the best score, and the best
number ever made, on its own tile under the score.

**The score.** A number is worth its face value, and a merge pays the value
of one of the pieces merged, times the chain — three 1s pay 1, three 40s pay
40. A blast pays what it destroys. A full climb runs to a few tens of
thousands.

There is no menu. The game opens on the board — the run left off last time,
or a new one. How to play, sound and start over sit at the top left (start over
takes two taps mid-run, so a stray one never throws a run away); on the web a
fourth button there opens a panel about the game — what it is, where to get
the app, and the privacy page. The score and the best under it sit centred,
halfway between the top of the screen and the grid; the piece in hand and the
bomb sit side by side under it. When the board fills, the end card shows "game
over", the run's score, and the best under it; a tap anywhere starts the next
run.

**How to play** is seven short pages, a line each, played out on a little grid
of the game's own pieces — dropping, three making one, chains, numbers falling
in, the bomb, and the climb to the 100 — with the same shattering as the
game.
It opens by itself the first time the game is played (remembered under
`thirtyfive.tutorial` in `localStorage`), before anything drops: the run
waits behind it, and the first 1 falls in once it is closed, skipped or
played through. Skip sits beside Next on every page but the last. After that
first time it opens only from the ? button.

## The look

Every piece is a flat square with its number in white. Everything the game
writes — the numbers on the pieces, the score, the best, the few words it
says — is set in one rounded face, at weights that vary by role: heaviest on
the pieces and the score, lighter for the lines of the tutorial. The grid and
the buttons are white. Behind it all, the
colours of the numbers on the board — in pastel, so the tiles stand out —
blend into one another and wiggle slowly in place. The colours go up the ladder in
sets of four — 1 to 4, 5 to 8, and so on — and each set wears one colour, the
lowest of the four in a light shade of it and the highest in a deep one. Every
set starts a little darker than the one before, so the run walks the whole
wheel — green, yellow, orange, red, pink, purple, violet, blue, and a deep teal
for 33 to 36 — and the start of a run looks as easy as it plays while the top
looks as hard as it is. The palette has 36 colours, so from 37 the numbers
walk it round again. The 100 alone wears every colour, round the clock,
turning slowly, blurred into one soft sweep so no centre and no spokes show
— and the app icon is the same picture (`tools/icon.js`, which can draw a
plain diagonal rainbow instead with `--style=diagonal`). The shades are
made by `tools/palette.js`: the hues and the steps are set there, and
`npm run palette` writes them into `css/numbers.css`. The bomb is the one
piece that is not a number, and it does not look like one: black, with its 0
in white and rainbow dust blowing out from its centre to its sides, a colour
explosion held in, and it shakes harder through its last three turns. While
the board waits for the column the bomb in hand goes to, the edge of the grid
wears the dial's light, the rainbow going round it and strokes going out past
it, and a line under the score says what is wanted.
Whatever leaves the board — merged or blown up —
breaks into squares of itself that fly to the edges of the screen: a few
large squares for a lone merge, more and smaller the longer the chain, up to
the third link, and the most for a blast.

A strip at the foot of the screen, under the piece in hand and the bomb, is
kept clear for a banner ad (60pt on a phone, 90pt on an iPad; `--ad-space` in
`css/theme.css`). The layout is checked on every iPhone size from the SE
(375×667) to the 16 Pro Max (440×956), with room for the notch and the home
indicator.

## Layout

```
index.html         the game
css/
  theme.css        page tokens, reset, base type
  components.css   the points that fly to the score
  game.css         the board, the hand, the buttons, how-to, about, end card
  charges.css      the bomb dial
  backdrop.css     a soft rainbow turning behind everything
  numbers.css      the palette, the flat square pieces, the black bomb
js/
  core/            config (every tunable number), events, storage
  data/pieces.js   the ladder 1–100, the bomb (and infinity, switched off)
  systems/         state and rules — board, round, charges; never touch the DOM
  ui/              listen and draw — never edit state directly
  pages/game.js    boot
img/               the stores' badges, as they supply them, for the about panel
web/
  privacy.html     the privacy policy both stores link to
  site.css, site.js
tools/
  palette.js       the colours of the numbers, written into css/numbers.css
  stamp.js         cache-busting for the app builds and the website
  icon.js          draws the app icon for iOS, Android and the Play listing,
                   and the launch screen (needs Playwright with Chromium)
  sim.js           a bot that plays the game by its own rules, to measure the climb
store/
  play/            the Google Play listing icon and feature graphic
ios/               the Xcode project (Capacitor) — the iPhone and iPad build
android/           the Android Studio project (Capacitor) — the Google Play build
```

The two app builds live in their own folders, `ios/` and `android/`, and
share everything above them: both take the game from `www/`, which
`npm run build` makes from `index.html`, `css/`, `js/` and `img/`. The
website is built into `site/` by `npm run site`. Both build folders are
generated and not kept in git.

All tuning lives in `js/core/config.js`. To see what a change does before
making it, `npm run sim` plays the game a few hundred runs over with a
steady, middling strategy, under the settings listed at the top of
`tools/sim.js`, and reports how far runs climb, how many make the 100, and where the rest die
(`npm run sim -- 500 base,withinf` for more runs of fewer settings).

## Run it in a browser

```bash
npm run serve
```

Then open http://localhost:4173. Best score and the run in progress are kept
in `localStorage` under `thirtyfive.save`; the sound setting under
`thirtyfive.sound`.

## The website

The website is the game: the same `index.html` at `/`, with a fourth button
at the top left — on the web only — opening a panel that carries what a
landing page would: a line on what the game is, where to get the app, and
the privacy page. Beside it sits `web/privacy.html`, the privacy policy both
stores ask for a link to even though the game collects nothing. Once the
site is live that link is `https://<your pages domain>/privacy.html`.

```bash
npm run serve:site
```

builds the site into `site/` — the game, the privacy page, every stylesheet
and script URL stamped — and serves it at http://localhost:4173. Pushing to
`main` builds the same and publishes it to GitHub Pages
(`.github/workflows/static.yml`), so the online game is always the last
thing merged.

When the apps are published, put their store links into `links` in
`js/core/config.js` and the two badges in the panel come alive. The badges
are the stores' own artwork, used as they supply it and never redrawn:
`img/app-store.svg` is Apple's "Download on the App Store" and
`img/google-play.svg` Google's "Get it on Google Play". Both companies ask
that a badge be shown no smaller than 40 pixels tall, with clear space
round it, and only as a link to the app's own store page — which is why
the two are dim until the links are set — and that the trademark lines
under them go with them. The apps leave the panel out altogether: you are
already in the store's app, and neither store cares to see the other; their
listings carry the privacy link.

## Build for the App Store

You need a Mac with **Xcode** (from the Mac App Store), **CocoaPods**
(`brew install cocoapods`), Node, and a paid Apple Developer account.

1. `npm install` — once.
2. `npm run icons` — only if you change the icon; it redraws every icon,
   iOS and Android alike, and the launch images (`tools/icon.js`; it needs
   `npm install -g playwright && npx playwright install chromium` once).
3. `npm run ios` — builds `www/`, syncs it into the Xcode project and opens
   Xcode.
4. In Xcode, under *Signing & Capabilities*, pick your team. Set the version
   under *General* (1.0, build 1 for the first upload; raise the build number
   for every upload after).
5. Choose *Any iOS Device*, then *Product → Archive*, then *Distribute App →
   App Store Connect*.
6. In App Store Connect, create the app for the bundle id
   `com.bernardogramaxo.thirtyfive`, add screenshots (iPhone 6.9" and, because
   the app also runs on iPad, iPad 13"), a description, an age rating, and a
   privacy answer of *Data Not Collected* — the game stores nothing off the
   device. (Adding ads changes that answer: an ad SDK collects identifiers
   and usage data, and personalised ads need Apple's tracking prompt.)

The app is set up for that already: portrait on iPhone, every orientation on
iPad (iPad multitasking requires it), no export-compliance question
(`ITSAppUsesNonExemptEncryption` is off), and an icon with no transparency.

## Build for Google Play

This one builds on Windows, Mac or Linux. You need **Android Studio** (which
brings the Android SDK and a JDK), Node, and a Google Play developer account
(a one-time fee).

1. `npm install` — once.
2. `npm run icons` — only if you change the icon; it redraws the launcher
   icons under `android/app/src/main/res/mipmap-*` and the listing art under
   `store/play/` along with the iOS ones.
3. `npm run android` — builds `www/`, syncs it into the Android project and
   opens Android Studio. Let it finish its first Gradle sync (it downloads
   what it needs; a few minutes the first time).
4. To try it: plug in a phone with USB debugging on, or start an emulator,
   and press *Run*.
5. To publish: *Build → Generate Signed App Bundle / APK → Android App
   Bundle*. The first time, *Create new…* a keystore: pick a strong password
   and keep the file and the password somewhere safe and backed up — every
   future update must be signed with the same key, and there is no way to
   recover it. Choose the *release* build. The bundle lands in
   `android/app/release/app-release.aab`.
6. In the Play Console, create the app for the package
   `com.bernardogramaxo.thirtyfive`, upload the bundle to a testing track
   first (Internal testing lets you install it from the store in minutes),
   then promote it to Production.
7. The store listing needs: the icon (`store/play/icon-512.png`), the feature
   graphic (`store/play/feature-1024x500.png`), at least two phone
   screenshots (and tablet screenshots if you want it listed for tablets), a
   short and a full description, a content rating questionnaire (a puzzle
   with no user content rates for everyone), the *Data safety* form (no data
   collected, no data shared — the game stores nothing off the device; ads
   change that), and a privacy policy URL, which Play asks for even so: a
   page saying the game collects nothing is enough, and the website's footer
   says as much.

Every upload needs a higher `versionCode` in `android/app/build.gradle`
(1, 2, 3, …); `versionName` is what people see (1.0, 1.1, …). The project
targets Android 15 (API 35), as Play requires, and runs on Android 6 and up. The launch is the page's own grey, as on iOS, and the launcher icon is the same 100 on its rings, drawn by `tools/icon.js`.

## The stores' rules, and how the app meets them

Both stores review what they publish. This is a small offline puzzle with
no account, no ads, no purchases and no data collection, which keeps it
clear of most of the rulebook; what remains, and where it stands:

**Apple (App Store Review Guidelines)**

- *Completeness and minimum functionality* (2.1, 4.2): a full game, not a
  wrapped website — it works offline, every file is inside the app, and
  nothing is a placeholder. Test the store build on a device before each
  upload.
- *Design* (4.0): it behaves like an iOS app — safe areas respected, a plain
  launch screen, portrait on iPhone and every orientation on iPad, which
  iPad multitasking requires.
- *Privacy* (5.1.1): a privacy policy link is required for every app; the
  website's privacy page is it. The App Privacy answers are *Data Not
  Collected*. There is no account, so the account-deletion rule does not
  apply.
- *Accurate metadata* (2.3): screenshots show the game as it is, and the
  description says what it does. Age rating 4+.
- *Export compliance*: `ITSAppUsesNonExemptEncryption` is off, so there is
  no encryption question at upload.
- If ads ever go in: an ad SDK collects identifiers, so the privacy answers
  change, and personalised ads need the App Tracking Transparency prompt.

**Google (Play policies)**

- *Target API level*: Play requires new apps and updates to target Android
  15 (API 35); the project does. Android 15 draws apps edge to edge under
  the system bars, and `capacitor.config.json` tells Capacitor to keep the
  game below the status bar and above the navigation bar.
- *Privacy policy*: required for every app in the Play Console; same page
  as above. *Data safety* form: no data collected, no data shared.
- *Content rating*: the IARC questionnaire; a puzzle with no violence, no
  user content and no purchases rates for everyone.
- *Target audience*: say the app is not designed for children (13+). It is
  fine for children to play, but choosing children as a target audience
  brings the Families policy, which asks for more than this app needs.
- *Permissions*: only `INTERNET`, which Capacitor's shell needs; nothing
  sensitive, so no permission declarations.
- *App bundle and signing*: Play takes an `.aab` and signs it with Play App
  Signing; you keep an upload key (the keystore).
- *New developer accounts*: a personal account made after November 2023
  must run a closed test with at least twelve testers opted in for fourteen
  days before it can publish to production. Plan for that; internal
  testing is open to you at once.
- *Large screens*: the game is not locked to portrait on Android, so it
  rotates on tablets and Chromebooks, as Play's large-screen guidance
  prefers; the layout fits any shape.

**Both**

- The name, the art and the code are original; nothing is borrowed.
- The listing must match the app: no features promised that are not there.
- Say the same thing in both stores and on the privacy page, and keep all
  three in step when anything changes.

## Before you publish, on either store

- Bump the version: `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in
  Xcode for iOS, `versionName` and `versionCode` in
  `android/app/build.gradle` for Android.
- Play a run on a real device from the store build, not the browser: a merge,
  a chain, the bomb, the tutorial from `?`, sound, start over, and a
  reload mid-run to see the run come back.
- Screenshots come from a device or simulator running the store build; the
  stores want them at the device's own size.
- Both stores ask what the app collects: nothing, today. The moment an ad
  SDK or analytics goes in, both answers change, and Apple's tracking prompt
  comes into play.
- Keep the Android keystore and its password, and your Apple signing
  certificates, backed up off the machine.
