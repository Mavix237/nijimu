# nijimu — Project Guide for AI Assistants

> This file orients an AI coding assistant (Cursor, Claude, etc.) to the nijimu
> codebase: what it is, how it's built, where things live, and the non-obvious
> rules. Read it before making changes.

## Search and link previews (2026-11-26)

The site is a client-rendered SPA, so crawlers and link previews read
`index.html` first: it now carries the English landing's head — title
"nijimu 滲む — an interactive memory sculpting tool", a description,
canonical `https://nijimu.space/`, Open Graph and Twitter (`summary_large_image`)
tags, `og:locale` en_US with zh_CN as alternate, the icons, and JSON-LD (a
`WebSite` and a `CreativeWork`, both `inLanguage` en / zh-Hans, the
CreativeWork's description in both languages). A `<noscript>` gives the line
in both languages too.
- **Per route, at runtime** (`lib/pageHead.ts`, `startPageHead(router)` in
  `App.tsx`): title, description, og/twitter words and `og:locale` follow the
  route and the language (`onLangChange`, new in `i18n.ts`). Only `/` and
  `/memory` are public: they get a canonical to themselves; every other route
  (pond, recording, transcript, descent, naming — "a new memory — nijimu 滲む" —
  the labs, `/studio`, `/style`, `/ripple`, the revisit editors, unknown paths)
  loses the canonical and gets `<meta name="robots" content="noindex">`.
  `/keep/:id` is left to `KeepOnPhonePage`, which sets its own. The head's
  words live in `pageHead.ts`, not the i18n dictionary, because they are never
  drawn on the page and must not grow the `-zh` font subset.
- **/memory's own static head:** `scripts/route-heads.mjs` (in `pnpm build`,
  before `copy-404.mjs`) writes `dist/memory.html` from the built index with
  the gallery's title, description, canonical and og/twitter words, and
  `vercel.json` rewrites `/memory` to it (before the SPA catch-all). Keep its
  words in step with `HEADS` in `pageHead.ts`.
- **public/** (it already held `.nojekyll`): `robots.txt` (allows all;
  disallows `/api/`, `/keep/`, `/lab/`, `/studio`, `/style`; names the
  sitemap), `sitemap.xml` (`/` and `/memory` only), `og-image.jpg` (1200 × 630,
  the preview card: the user's photo, see the favicon section below; a first
  card of the landing's washes with 滲む nijimu set over them was replaced the
  same day), and the icons `favicon.svg`, `favicon-32.png`,
  `apple-touch-icon.png` (180, full bleed). Vercel serves files before rewrites, so these are not swallowed by
  the SPA rewrite.
- **Headers** (`vercel.json`): `X-Robots-Tag: noindex` on `/record/*`,
  `/memory/*` (not `/memory` itself), `/lab/*`, `/studio`, `/style`, `/ripple`;
  `/keep/*` keeps its noindex, nofollow and no-referrer.
- **Deliberately not done:** no hreflang or separate Chinese URLs (one URL
  serves both languages, chosen by the browser or `?lang=`; Googlebot renders
  in English), no prerendering of other routes, no author/person in the
  JSON-LD (not chosen by the user), no `keywords` meta (ignored by engines),
  no new dependencies. `theme-color` is unchanged (#e4e4e6).
- **For the user:** verify nijimu.space in Google Search Console (a DNS TXT
  record at the domain registrar) and Bing Webmaster Tools (can import from
  Google), submit `https://nijimu.space/sitemap.xml`, then check a preview
  with a link-preview debugger (e.g. opengraph.xyz or the platforms' own).

## Google Analytics (2026-11-26)

GA4 (`G-KJ4XS9DK9M`) is loaded from code, `lib/analytics.ts` (`startAnalytics()`
in `main.tsx`), not from `index.html`. Page views only: nothing of a memory
(words, names, photos, recordings) is sent. It runs on nijimu.space and
www.nijimu.space alone, so local work and Vercel previews stay out of the
numbers; `?analytics=debug` loads it anywhere for the visit with `debug_mode`
(GA's Admin → DebugView). The `/keep/:id` phone page never loads it (its id
opens a saved card for a day), and every location sent passes `cleanPath`,
which writes `/keep/<id>` as `/keep`. In-app page changes are counted by
GA4's enhanced measurement (history events); a patched
`pushState`/`replaceState` keeps the `page_location` GA reads clean.
Access is given in GA itself (Admin → Property access management).

## Favicon: the 2022 vessel in the landing's washes (2026-11-27)

`public/favicon.svg`, `favicon-32.png` (transparent) and `apple-touch-icon.png`
(180, full bleed on the gallery's ground #edecec, the vessel at .74) are the
silhouette of "Left a place I thought I'd stay longer" (id 8, the pointed 2022
vessel) — traced from the gallery's own render of it (its canvas alpha, row by
row, cropped to the seat so the reflection is left out) — washed with the
landing's tones (`LANDING_TONES`: purple, sky, rose, sand, a pale mist pool)
as soft radial gradients, a little pigment pooled at the rim, and a fine
grain (an feTurbulence filter in the SVG; in the PNGs, noise added per pixel,
since AppKit, which rasterised them, draws no SVG filters). The washes need no
filter, so any renderer draws them. Later that day it was made lighter (a paler
ground, the coloured washes at ~.8 of their first strength, a lighter rim) and
its pale centre wider with a long, even falloff (rx 27, five stops). Then
retoned to the landing as it is seen, not its palette's hexes: the washes are
the landing's own pale mauve-grey, blue-grey, rose and warm white (sampled from
screenshots: ~#d7d3d8, #cad5d8, #dac1c2, #e5dedd), each a step deeper (#c4c1cc,
#bccacf, #cfafb3, #d3c7c5), the glow a faint lift (.45 at its centre), the rim
in the same grey-mauve, the grain halved (the SVG's dark-only grain .08, the
PNGs' ±1.5–1.8%). It replaced, the same day, a 滲 in
GenRyuMin2 TW on the page's grey.
The link-preview image, `public/og-image.jpg` (1200 × 630, `og:image` and
`twitter:image`), is the user's photo of the gallery on a laptop
(`embed thumbnail.png` at the repo root, kept out of `public/` so it is not deployed; 2378 × 1326) scaled to 1200 wide and cropped
~20 px top and bottom; `og:image:alt` describes it.

## The handling continue answers the pointer (2026-11-25)

The continue on the shape, rhythm, distance and colour steps — the desktop
pill and the phone's round button — fills a little further under a mouse
and a little further again while pressed (`.nijimu-continue` in `motion.css`;
`PillButton` `continuePill`). The resting tint is unchanged (light
`rgba(123, 123, 135, 0.16)`, the colour step's dark pill
`rgba(218, 218, 218, 0.25)`), and the press still scales to .97. Hover is a
mouse only. The shape step's held continue keeps its dim fill and does not
lift. The colour step's pill, whose resting tint is nearly the water, answers in a
slightly deeper grey so the change still reads.

## English / Chinese (2026-11-25)

The interface reads in English or Simplified Chinese (Traditional at first,
the same day; switched on request). A toggle sits in the
header beside the music, at `--chrome-r1`: the language it switches to as a
word in `CHROME_GRAY` — "中" while the page is English, "EN" while it is
Chinese — in a sans of its own (`LANG_GLYPH_FONT` in `App.tsx`: Switzer, then
the system's Chinese sans, never GenRyuMin2 TW, so the "中" costs an English
visit no font download; it was Lucide's "languages" glyph at first). Its hover
name is "中文" / "english"; on a phone (≤600px) it is a row of the burger menu
(`HEADER_MENU_ORDER.lang`, above music). The gallery's plus and view toggle
moved one seat left to make room (`--chrome-r2`, the field's toggle
`--chrome-r3`); the gallery's arrows stay where they were (`--chrome-r1`). The
choice is kept per device (localStorage `nijimu.lang`; `?lang=zh|en` sets it),
switches live without a reload, and sets `<html lang>` (`en` / `zh-Hans`).
With no choice kept and no `?lang=`, a first visit follows the browser's own
languages (`browserLang`): the first of `navigator.languages` that is Chinese
(any `zh-*`, Traditional tags included) or English, in its order; English when
it names neither. That guess is not kept — only the header toggle or `?lang=`
is — so a later change of the browser's language still counts until the
visitor picks one. (Location was considered and not used: it guesses language
less well than the browser does, and would cost a request before the first
words.)
- **Dictionary** `src/app/lib/i18n.ts`: one typed table, `en` (the shape) and
  `zh` (`Messages`, so a missing key is a type error); strings, or functions
  for the ones with numbers or names in them. Components read `useT()` (named
  `ui` in the big files, where `t` is time); code outside render reads
  `messages()` (the phone hand-off's errors). Errors kept in state are kinds,
  not English sentences, so they follow a switch; the transcription service's
  own English reasons still show in English, Chinese says it plainly instead.
- **Translated:** the header and burger menu, the landing's line and Enter,
  the gallery's intro lines, tips and labels, the pond (heading, hold, the
  floating questions), "Before you begin" and recording, the transcript screen,
  the photo step and the descent's steps (instructions, sliders, follow tip,
  camera), the camera dialog, naming (fields,
  year hints, save), "Keep a copy" and Save to your phone, the `/keep/:id` page
  (the QR link carries `?lang=zh` when made in Chinese, so the phone opens it
  so), the reading pane and the profile. Chinese is set in a quiet register;
  English keeps its lowercase, Chinese has none. The landing's line breaks in
  two at a written `\n` (it is only as wide as the Enter row);
  `ParticleText` now lets a Chinese line break between characters.
- **Left in its own language:** the memories themselves — the curated names,
  years and transcripts in `data/`, the landing's floating captions, the
  vessels' and cards' names, a visitor's own words — and the 滲む nijimu
  wordmark. The labs' knobs and dev panels stay English. So does the word
  under each handling step's character (形 shape, 律 rhythm, 間 distance,
  染 color): `STEP_COPY.name` in `DescentPrototype` is that English word in
  both languages. The dictionary's `stepShape` and the rest are only what a
  screen reader hears on the drag, so that name still follows the language.
  The instructions under the word are translated.
- **Fonts:** `SANS` and `SANS_UI` fall back to GenRyuMin2 TW, so Chinese in a
  sans line is the site's Ming; `html:lang(zh)` turns off font synthesis
  (no faux italic or bold on CJK). A third face, `GenRyuMin2TW-Regular-zh.woff`
  (~90 KB, the 387 characters of the dictionary), is fetched only when Chinese
  copy is shown; an English visit still fetches only the 8 KB `-ui` subset (the
  toggle's "中文" is written only once hovered or the menu opened, for that
  reason). It is a WOFF cut from the family's OTF; after changing the `zh` table
  rebuild it with `scripts/zh-ui-chars.mjs` (README, "Fonts"). The family is
  a TW one but its OTF carries the simplified characters, drawn in its TW
  forms; the 2.2 MB full face is a TW subset without most of them, so a
  character missing from the `-zh` subset falls to the system's font.

## Save to phone, by QR code (2026-11-25)

On a desktop (wider than 600px with a mouse: `useCompact()` false and
`(hover: hover) and (pointer: fine)`), "Keep a copy" offers **Save to your
phone** between the download and continue. Pressing it (the consent) sends the
card — the same image the download keeps, re-encoded as a JPEG under 3.6 MB by
`keepForPhone` in `lib/shareToPhone.ts` — to `POST /api/share`; the words'
column then shows a QR code of `/keep/<id>` (`qrcode`, lazily imported, drawn
in the header's `CHROME_GRAY`), "Done" (continues) and "Back" (Escape too). Phones never see the
option; they download.
- **Server** (`server/share.mjs`, plain JS): a 22-character random id
  (16 bytes, base64url); the image is stored in Vercel Blob as
  `keep/<id>.jpg`, **private** by default (`SHARE_BLOB_ACCESS=public` only for
  a public store), and only ever served back through `GET /api/share?id=…`,
  which refuses anything older than `SHARE_TTL_MS` (24 h) with 410. Each upload
  also sweeps what has expired; `api/share-sweep.mjs` is a daily Vercel cron
  (`vercel.json` "crons", 04:00 UTC) that needs `CRON_SECRET`. So an image is
  unreadable after a day and deleted within about two at most.
- **Phone page** `/keep/:id` (`components/KeepOnPhonePage.tsx`, outside
  `RootLayout`: no music, gallery or header controls; noindex,
  no-referrer): only the card and one text button, "save to your photos"
  (no wordmark or notes). It fetches the image once on arrival, then the button
  opens the share sheet with the file (Safari drops a gesture across a fetch,
  hence the prefetch), else downloads; a long press on the image works too.
  An expired or unknown id says so.
- **Setup on Vercel:** create a Blob store set to Private and connect it to the
  project (sets `BLOB_READ_WRITE_TOKEN`), and add `CRON_SECRET`. Without the
  token production answers 503 and the dialog says it isn't set up.
- **Dev:** `server/vite-plugin-share.mjs` mounts the same endpoint; with no
  token it keeps cards in memory until the dev server restarts. When the page
  is open on localhost the answer names this machine's LAN address
  (`origin`), so a phone on the same Wi-Fi can open the code (the dev server
  already listens on all interfaces).

## The recording dialog's demo picks hidden (2026-11-25)

The small 1 2 3 beside "skip to a sample story" in the recording dialog (each
begins the flow with one of `DEMO_MEMORIES`) no longer show. `?demo` in the
address brings them back for presenting (`DEMO_PICKS` in
`PondRecordingOverlay`, which passes `onMemory` only then; the dialog draws the
picks only when it has it).

## The landing's centre a little larger, its washes closer together (2026-11-25)

The landing's description is 13px (`HEADER_DESC_SIZE`, was 12) and the centre
block's gaps 30px (`HEADER_GAP`, were 28). The Enter row (label, 滲む nijimu)
takes the floating captions' size, `BLOB_CAPTION_SIZE` (13–15px; the label
was 13, the mark 12–16), its arrow 1.1em of it. The opening's first washes
are followed sooner by the rest: `LANDING_MOTION.reveal.second` 500 (was 650),
`restFrom` 950 (was 1500), and the copy waits longer after them:
`copyAt` .58 of the opening (~4.9 s, was .45, ~3.8 s). The "landing opening"
panel's key is now `nijimu-landing-opening-3`, so a panel kept before no longer
covers these.
The gallery transcript under one memory, "Started designing seriously" (id 6),
is a little wider, 64ch (`CAPTION_TRANSCRIPT_WIDTH` in `PuddleDiveGallery`; the
rest keep 60ch), so it sets as four lines without "where it started." alone.
The gallery's create (plus) leaves for the pond from the memory in hand: it no
longer scrolls the rim to the newest first (`openPondFromPlus` passes that
memory's id through `onOverscrollExit(fromId)` → `onPondEnter` → `openPond`), and
back from the pond (`closePond`) opens the gallery on it (`pondFromId`; the
newest when the pond was reached by scrolling past the end, or loaded directly).
The transcript screen's "continue" pill wears the dialogs' glass: `PillButton`
`surface="glass"` — `GLASS_FILL`/`GLASS_BLUR` (exported from `GlassPane`, the
phone's denser pair under 600px) and the paper finish's fine grain
(`PaperFinish fine`), in place of the flat grey tint.
Naming's "save memory" wears the same pill (it was a text button): `PillButton`
with `trailing="›"`, `surface="glass"`, `textBlend="multiply"` (`NamingRim`).
Its words and "record again"'s are drawn in multiply (`PillButton` `textBlend`,
TextButton's `mixBlendMode`), so they darken into the water and the glass. For
that to reach the pond nothing between them and the stage may isolate: the
actions' row is centred by its margins (no transform) and the transcript
screen's root has no z-index (was 30; it follows the water in the stage). While
the screen fades out (opacity < 1) the words briefly draw in normal blending.

## "Keep a copy" shows the card (2026-11-25)

After "save memory", `SaveMemoryDialog` no longer opens a glass pane over the
vessel. It makes the memory's card as it opens — the same offscreen vessel
render and `memoryImage` composition the download uses (wordmark, vessel,
title, year, transcript; 2400 × 3500) — and shows it in the vessel's place,
its paper (`CARD_PAPER`) first and the picture fading in over it, with the
dialog's title, copy and options to its right, centred on it and set from the
left (on a phone, under it). Naming fades its whole grid (fields, vessel,
save) away while it is open (`NamingRim`'s new `saveDialogOpen`, read by
`PondNamingOverlay`). "Download as image" keeps the card already made (a press
before it is ready waits for it, "Preparing your memory…"); a card that never
comes says so after 30 s and a press tries again. Escape or a press off the card
and words goes back to naming. Card and words come in with a short rise
(`ENTER_MS` 700, the words 120 ms after). The card casts no shadow; the pond
shows round it.
The card's frame is borrowed, not rendered in a context of its own
(`lib/cardFrame.ts`): one more WebGL context was enough, on a full visit (the
hidden gallery's seats, the pond, the naming vessel), for the browser to drop
the oldest — seen dropping the pond's — so the water vanished behind the card
and only the page's ground and grain showed. Now the dialog asks
(`askCardFrame`); naming's own vessel, hidden behind the card, dresses as the
card's vessel for a moment (`cardVesselOf`: its glass, stain and room, no lake
reflection; `dpr` set for the card's 1920 px frame, `CARD_FRAME_PX` 960 at
`CARD_SCALE`), lets its canvas settle five frames and hands over its next
complete frame (`capture` → `giveCardFrame`), then goes back to naming's dress.
Only if none answers in `BORROW_WAIT_MS` (6 s) does the dialog render the
vessel offscreen itself, as before.

## Naming without its transcript; continue guides to the tip (2026-11-25)

Naming no longer shows the memory's words under the fields
(`PondNamingOverlay`'s `inlinePassage` is empty; a phone still opens them in
`MemoryReadingPane` by pressing the vessel). The vessel takes the room they
left, at its own seat, and the name and year come down toward it: their lift
`NAMING_TUNE_DEFAULT.layout.textLift` is 3vh (was 6, when it lifted the words
too), ~16 px above the glass on a 768 px window. The vessel also floats a
little higher over the lake and the eye rises with it: its mirror plane sits
`reflection.gap` .14 under the foot (was .03), naming's pond camera stands
`layout.cameraLift` .5 higher than the pond's own (`pondCameraPose`'s new
`lift`, passed by `MemoryPondPage` as `cameraLift` on naming only), and the
vessel is seen from `layout.viewPitch` 7° (the gallery's 4°). Later the same
day: the vessel and its fields came 3vh down together (`artifactLift` 3,
`textLift` 0; were 6 and 3) and the pond further — the view tilts up
(`layout.lookLift` 2.1, the look point raised, ~2.9°, ~6vh; `pondCameraPose`'s
new `lookLift`, also eased out through the Back sink) — and the reflection is
less fractured: the lake pass reads the water's slope averaged over
`reflection.smooth` (.3 world units, five taps of `pondSurfaceNormal` —
`uWaterSmooth`), so it breaks with the pond's broad swells rather than its
finest wrinkles, at `ripple` 1.2 (was 1.66) and `soft` 1.8 (was 1.2). Later
it was made a little more prominent: `reflection.strength` .6 (was .46), and
the name and year went up 2vh (`layout.textLift` 2, was 0). The
naming panel's key is now `nijimu-naming-6` (renamed five times that day),
so a set kept before does not hold the old values.
On the shape step, while continue is held for the camera (`continueHeld`), it
no longer hides: the desktop pill wears the disabled look but takes a press
(`PillButton`'s new `looksDisabled`: the dimmed text and fill, `aria-disabled`,
no `disabled` attribute), and a press draws the way to the follow tip — a
line down from the pill's foot and right to just short of the tip's first word,
a soft 10 px corner (`showContinueGuide`, measured at the press), 0.75 px at
.55 opacity (`GUIDE_WIDTH`, `GUIDE_OPACITY`; was 1.2 px, full) — drawn in over
`GUIDE_DRAW_MS` (900), held, and from `GUIDE_ERASE_FROM_MS` (2 s after it
began) trimmed away from its start toward its end (`pathLength` 1, a
dash offset 1 → 0 → −1; gone at `GUIDE_TOTAL_MS` 2.9 s). The phone's round
continue wears the same unavailable look; a press there does nothing.

## A larger camera window, and a tip to follow its animation (2026-11-25)

On desktop the handling steps' corner camera is 25% larger (`DESKTOP_CAMERA`
160 × 120, was 128 × 96) and so is the gesture animation over it
(`GESTURE_HINT_SCALE` 1.25, scaled from its foot so it keeps 12 px above the
camera). The continue row is as tall as the camera and stands on
the same foot (`DESKTOP_ACTION_ROW` = the camera's height; briefly 96), so the
pill's top is level with the camera's top. On the shape step a
one-line tip sits beside the camera, its foot on the camera's bottom edge and
`FOLLOW_TIP_GAP` (28 px; briefly 16) from it, an arrow pointing to it:
"follow the animation with your hands →", at the steps' instruction size
(14 px) in the body ink (`UNDER_INK`, `CHROME_GRAY`; briefly the gallery tip's
12 px and lighter ink), fading in and out with a blur. It shows while that
animation does — the camera reading (`followTipShown`), coming `FOLLOW_TIP_DELAY_MS` (2 s) after it is due
(`followTipDue`) and going at once. On the shape step, with the camera on and
reading, continue is held (an unavailable look, see "continue guides to the
tip" above; briefly it was faded out) until the camera has moved the form — a gesture applied there
(`cameraMoved`, set in `takeGesture`; `continueHeld`); it comes at once with
the camera off, or on but not reading, so a lost camera never traps the step.
Neither the animation nor the tip gives way to the
hands any more: they stay while the camera reads, with or without a valid
gesture (`GestureHint` `active` false; briefly they held 20 s after a step's
first valid gesture and then stepped aside while hands drove, and before that
they hid at once). The animation over the camera is a touch darker
(brightness .82 at .92 opacity; was .8, unfiltered), and its lines are
thicker: the drawings are fine raster lines, so `GestureHint` thickens them in
their own ink — an SVG filter on its stage that blurs the drawing slightly
(`GESTURE_THICKEN` .17, in the hint's own px; briefly .3, then .22), firms that blur's alpha
(`GESTURE_FIRM` × 1.2; briefly 1.7, then 1.35) and lays it under the drawing; every hint, phone and
desktop, the GIF too. It was a `feMorphology` dilate (.45, .25, .12, .18 px),
but Chrome rounds a dilate's radius to whole device pixels: under about half a
device pixel it did nothing, and above it jumped to a full pixel. While the camera reads a
valid gesture (`gestureLive`: enough hands for the step) a white ring widens
round the camera window, 0 → `CAMERA_RING_PX` (3) over 720 ms
(`cameraRing`, a box-shadow on its switch layer; the phone's capsule wears it
too), and narrows away when the hands go. Phones' foot row is otherwise
unchanged.

## The steps' instructions ink in (2026-11-25)

The instruction lines under each sculpting step's heading (shape, rhythm,
distance, colour) now come in as the gallery's transcript does — line by line,
a haloed wash in the paper's grain filled solid by a wet front from the left
(`LINE_INK_MS` 1.6 s, `LINE_STEP_MS` .26 s apart) — in the design system's
lighter ink, a step under the heading (`INSTRUCTION_INK` = `PANE_INK.secondary`
#9b9ba3; briefly the heading's `CHROME_GRAY`). They start `INSTRUCTION_AFTER_MS` (1 s) after the rest of the
step has come: arriving under the water, after the chrome's 900 ms fade; on a
new step, after the heading's own entrance (`TEXT_ENTER_MS`)
(`StepInstruction` in `DescentPrototype`, keyed by the step). On a phone the
paragraph inks as one block. The entrance now lives in
`components/InkLines.tsx` (`inkKeyframes(name, ink)`, `inkLineStyle`,
`InkLines`); the gallery's `CaptionTranscript` takes its keyframes and timings
from there, unchanged.

## Under the water: the camera dialog springs in, then the chrome (2026-11-25)

Arriving on the first handling step (the dive's end, or a load straight onto
a step) only the vessel and the header are there: the camera dialog comes
first, `DIALOG_AFTER_ARRIVAL_MS` (1.6 s) on (`dialogDue` gates
`cameraDialogOpen`), and once it has been answered and closed (a camera
running, or "maybe later": `cameraAnswered`) `DescentRun` fades the step's
chrome in together — heading and copy, continue, slider, the gesture, the
camera window and its switch, its tip, the colour field — over `CHROME_IN_MS`
(900; `chromeIn`, `chromeFade`; leaving keeps its 700 ms). With nothing to ask
(a choice already made, `?camera=off`) the chrome comes at once; once in it
stays. (Briefly the order was the other way: chrome first, the dialog 150,
then 700 ms after it.) The
slider is not part of that fade: it waits for the camera's answer
(`sliderShown`) — hidden while the dialog is to come or open and while a
camera starts, shown once the dialog is closed without one ("maybe later",
`?camera=off`) or whenever a camera that was on is not reading hands. The
dialog reads "Enable camera access" / "We use camera to access hand-tracking,
which allows you to sculpt this memory by hand. Please allow camera access
from your browser." (was "Sculpt this memory by hand"). Its "Allow camera &
Begin" wears the camera alone (the check that had been paired with it is
gone), and the solid camera's lens ring is cut through its body (an SVG mask in
`CameraIcon`) so the pane shows in it, the pane's own colour (it had been
drawn white). Moving between
steps does neither again. The dialog comes in with `GlassPane`'s new
`entrance="spring"` (`HandTrackingDialog` passes it through): the card scales
up from `SPRING_FROM` (.9) to its own size over `SPRING_MS` (640) on
`SPRING_EASE` (cubic-bezier(.34, 1.56, .64, 1)), overshooting to ~1.01 and
settling at 1, while it fades in over 360 ms. Every other pane keeps the
"rise" (a little up into place); reduced motion keeps only the fade.

## The pond fades in on a load; much-faceted pictures hang round (2026-11-25)

A load or reload straight into any pond page (pond, recording, transcript,
descent, naming) no longer shows the stage at once: `LandingPage`'s
`loadFade` holds the stage clear over the ground until its scene has drawn
(`pondReady`, `PondWater`'s first frame) or `POND_LOAD_WAIT_MS` (2.5 s), then
fades it in over `POND_LOAD_FADE_MS` (1.4 s) — sky, water and everything over
them. Arriving from the gallery is unchanged. The gallery mounted behind a
settled pond is now hidden (it could show through the fade).
The transcript's edit tip now sits above the words, `TIP_GAP_VH` (14.6vh)
clear of the first line — ~112 px on a 768 px window, 146 on a 1000 px one
(`calc(FLOW_PAGE.headingTop + 121px − 14.6vh)`: the words start 137 px under
the heading row; briefly 25 px, 50, then 75; `QuietTip`'s new `top`), not
under the wordmark.
A vessel with many facets no longer folds its picture across them:
`floatWall` counts the creases the wall has round its axis (`wallCreases`:
corners, convex or concave, weighted by sharpness, over the body's middle
heights), and past `CREASES_FROM` (5) the picture follows the facets in
inverse proportion to them: its share (1 − float, .5) × 5 / creases (briefly
a ramp to fully round at 10). The library: Y-07 ~1.8 and the diamond E-14 ~3.6
follow 50% (as before), the lantern Y-17 ~5.6 45%, star/flower/gear ~7 about
37%, Y-01/E-08/Y-04/E-02 9–10 about 25%.

## A brighter, closer glow on the pond's dot; the transcript's edit tip (2026-11-25)

The pond's cursor sphere glows brighter and closer: `POND_TUNE_DEFAULT.sphere`
glow .7, halo .45, the halo's width a knob, `haloWidth` 3.2 radii (`uGlow.w`
in `glowFragment`; a fixed 3.6 before the knob), reach 7 — ~1.5× as bright
within two radii, gone by ~6 radii. The dot itself is out of focus:
`sphereFragment` thins it toward its silhouette as the surface turns from the
eye (`uSphereSoft` = `sphere.soft`: up to 1 the share of the way in from the
rim it reaches, past 1 — to 3 — the fall-off raised to it, flatter still; 1.6,
briefly .7; 0 is the old cut edge; a knob in the panel's sphere folder), and
it is a touch larger so it does not read smaller for it (`radius` .05, was
.045). (Earlier the same day it was widened
instead: glow .42, halo .3 at 5 radii, reach 10; before that glow .3, halo .12,
reach 6.) The "pond" panel's sphere folder has the new
knob; a panel kept in this browser (`nijimu-pond-2`) still wins over these.
The transcript screen has a tip under the wordmark once the words can be
edited: "click on the transcript to edit" ("tap…" on a touch screen,
`TranscriptEditHint`). It is the gallery's "keep scrolling" tip in place, size,
ink, tracking and the 5.4 s breath, but the breath goes clear (opacity 0 at
mid-cycle, was .566) and it does not wait the gallery's 5.5 s: it begins the
moment the words have finished printing, and keeps cycling after they are
clicked into (it leaves with the screen on continue). The gallery tip still
waits 5.5 s and still only dips to .566.

## The picture follows the facets, its edges effused (2026-11-25, later)

The floating strip (below) now keeps some of its vessel's facets: it is
settled halfway between the wall and the round cavity inside it (`float` .5,
was 1 — round). To turn with the eye without passing through the glass it is
no longer turned as a rigid body: `sheetVertex` turns each point by
`uFloatTurn` and carries it in or out by the cavity where it now is over the
cavity where it was settled (`uCavity`, a 96×48 half-float radius map built
with the cloth, `cavityTexture`; `Sheet.cavity`, disposed with the build), so
it takes the facets in front of the eye at every angle. `uFloatOn` is 1 for
every draped sheet; at turn 0 nothing moves, so the opening view is as hung.
`sheetFloatMatrix` is now only the turn, for the mirror's foot.
The picture's edges are more effused, for every vessel
(`VESSEL_TUNE_DEFAULT`): the photo thins into the stock over `edgeFade` 5.5 mm
(was 2.5), the strip's outline feathers by `wear` 2.2 (was 1.16; the knob now
reaches 3) and furs where it turns away by `softRim` .35 (was .2). E-14 (2024),
which had its own wider fade (5), now has 8.

## Naming's fields stand over the vessel (2026-11-25)

A spiky form (small n) is given more canvas room (`vesselCanvasScale`), and in
naming its canvas reached up over the name and year fields: the seat was
`zIndex: 1` while the heading row had no layer of its own, so the vessel's
drag took the fields' presses and caret. `PondNamingOverlay`'s heading row is
now `position: relative; zIndex: 3` (and the inline passage 2), so the fields
win wherever they overlap the canvas. The heading lets presses through outside
the fields' rows, so the vessel can still be turned from anywhere else.

## No short word ends a transcript line (2026-11-25)

In the gallery's transcript under the year (`CaptionTranscript` in
`PuddleDiveGallery`), a word of fewer than `SHORT_WORD_LETTERS` (3) letters or
digits ("I", "a", "to", "is,") never ends a line: `bindShortWords` binds it to
the word after it in the unseen measuring copy (one `nowrap` span per group,
the space between groups outside it), so where it would have ended a line it
starts the next. A run of short words binds on to the first longer word; short
words at the very end ride with the word before them. The visible lines are
read from that copy as before.

## Sliders give way to the camera (2026-11-25)

On the shape, rhythm and distance steps the slider fades out (700 ms, and
`inert`) while the camera is reading hands (`tracking.isTracking` in
`DescentRun`) and fades back whenever it is not — camera refused, failed,
stopped or switched off. The full-screen drag stays either way. The camera
can now be switched mid-step: the desktop corner window and the phone's foot
capsule are buttons (`toggleCamera`; off shows a pale pane with a
struck-through camera, `CameraOffGlyph`). Off lets go of the hands
(`handsGone`, also the tracker's `onNoHands`) and sets `cameraChoice`
"manual"; on again is "resuming", which starts the camera without reopening
the dialog. The choice carries across steps as before, so a camera left on
opens the next step with its slider already hidden.

## The picture floats free in the vessel (2026-11-25)

The draped strip is no longer fixed to a place on the wall: it hangs free in
the glass and turns about the axis with the eye, so the picture keeps facing
the viewer while the glass turns round it. To turn anywhere without passing
through the glass it is settled against the round cavity inside the form
(`floatWall` in `VesselPreview.tsx`: at each elevation the wall's least radius
round the axis) instead of the wall itself. Each frame the strip (and its
reflection) takes `sheetFloatMatrix` — a turn of (eye's azimuth − the azimuth
it opened at) — in `VesselArtifact` (gallery, naming, studio) and the lab's
`Stage`; the opening view is unturned. On round forms the opening view is as
it was; on angular or lobed ones (the diamond) the strip sits further in than
the facets it used to lie on, so the picture reads smaller. `float` (tune,
"drape" group, "floats free"; 1 by default, in `vesselPartsKey`) is how far
the cloth is drawn into that cavity; 0 is the old hang on the wall (it still
turns, and may then pass through the glass on a non-round form). The descent
builds and follows the same cavity (`followWall`), so the strip it hands to
naming matches. The pressed sheet is unchanged (`Sheet.floats` false).

## Vessels lift off their reflections (2026-11-25)

Leaving the gallery for the pond, each vessel now rises faster than its
reflection, so the reflections read as a ground the vessels leave behind.
A vessel goes `POND_VESSEL_LEAD` (.5) further than its seat
(`lib/pondTransition.ts`: `pondRimLead` on the rim, 1.2 × the height × the
rim's lift × .5; in the field, its own lift × .5); its reflection keeps the
seat's pace. `PuddleDiveGallery` sets that lead on each seat as
`--vessel-lift` (px of the unscaled seat) and passes `departing`
(`ArtifactSeat`) while `pondDeparture` > 0, not under reduced motion. The
reflection is drawn in the vessel's own canvas, so `VesselArtifact` `split`
renders one more frame, copies it into a 2D canvas (a still) and notes where
the mirror plane under the foot falls on it; the still shows below that line
(masked, a 1.2% feather), riding with the seat, and the live canvas shows
above it, translated up by `--vessel-lift`. No canvas redraws during the
move (the rim still holds its frames). The same plays backwards on the way
back from the pond, the vessels landing on their reflections; the still is
dropped at departure 0.
The reflections thin as their vessels recede (same day, later): the seat also
carries `--reflection-fade` (`pondReflectionFade`: 1 − an eased share of the
gap over .01–.58 of the screen height; a rim vessel's lead reaches .6), which
the still's host takes as its opacity — untouched until the vessels part (~.3
of the departure), about half at .6, gone by .8; backwards on the return.

## The transcript can be edited in place (2026-11-25)

Once the transcript has printed (or a click skipped it), `PuddleTranscriptPage`
swaps the word spans for one `contentEditable="plaintext-only"` block: a click
puts the caret in the words and they change where they are. It looks exactly
as the printout did — no outline, tint or spellcheck marks; only the caret
shows (`caretColor` `CHROME_GRAY`, cursor text). The printout sets its words
.3em apart as inline-blocks; the text keeps that gap with a measured
`word-spacing` (`WORD_GAP_EM` less the face's space and letter-spacing) and
`white-space: break-spaces`, so a line-end space takes its room as the
printout's margin did and the lines break in the same places. Edits settle
into the history draft `EDIT_SETTLE_MS` (400) after the last keystroke, on
blur, and on continue, which carries the edited words to the descent (so its
reading is of them). Enter adds no paragraph, Escape leaves the field, and
keys stop there (the pond's window listener would take Escape/ArrowUp as
back). An emptied field hides continue.

## Longer memories keep their reading (2026-11-25)

A memory told for longer than a minute often came out as a big plain sphere
that Shape could not change. Three causes, three fixes:
- The reading's quotes were checked verbatim (`isAssessment` needs every
  `beat.quote` in the transcript), and on a long memory gpt-4.1-mini tidies
  them — joins passages with "...", drops a leading "and"/"but" and
  capitalises the next word. One such quote threw the whole reading away
  ("did not pass validation"): a ~55 s English memory was rejected 7 of 9
  times, short and Chinese ones passed. Now `server/assess-memory.mjs` runs
  `repairAssessment` (`shared/memory-assessment.mjs`) first: each quote is
  re-found in the transcript ignoring case, spacing and punctuation
  (`findQuote`; an elided quote becomes the span it stands for, or its
  longest part if that runs past 500 chars) and replaced by the transcript's
  own words; a beat not found is dropped; summary/readings clip at 300,
  scores clamp. Stored quotes stay verbatim, so the strict check still holds
  in the browser. The prompt also asks for one continuous, unaltered passage
  per quote. After: 7 of 7 accepted.
- With no reading the form was `baseForm("sphere")`: Shape grew a sphere into
  a sphere (nothing moved until Rhythm) and, filling its whole bound, it sat
  far larger than any mapped form. It is now the map's middle,
  `formAt(.5, .5, seed)` (`source` still "fallback", `family` null).
- Recording stopped silently at 60 s. The cap is 180 s
  (`MAX_RECORDING_SECONDS`), recorded at 64 kbps (`audioBitsPerSecond`, so
  Safari's AAC stays ~1.5 MB under the 4 MB upload cap); the last 20 s show
  "· 12s left" beside the timer (`secondsLeft`). `vercel.json` gives the
  `api/*.mjs` functions `maxDuration` 60 so a slower transcription or reading
  is not cut at an older 10 s default.
`check-memory-shape.mjs` covers the repair and the new fallback.

## The gallery's words wait for its vessels (2026-11-11)

The caption (name, year) and the transcript under the apex no longer show over
empty seats: `PuddleDiveGallery` holds them (`vesselsLoaded`) until every seat
the gallery opens on (`openingIdsRef`, or the one in hand when there is no
such set) has drawn its first frame (`onFrame`), then
`WORDS_AFTER_VESSELS_MS` (450) more, so they follow the vessels' fade; capped
at `OPEN_READY_CAP_MS` (5 s), as the seats' own fade is. The transcript's
dwell starts only then. A carried arrival (from naming) and a caption handed
in (`caption`) are not held.

## The washes take their vessel's shape on the way (2026-11-11)

On Enter a seated wash used to keep its own shape all the way to its seat and
only then fill its cutout (`seatFillFrom` .85 of the drift, on a raised cosine
whose slow start put the first visible paint after it had arrived). The fill
now begins at `LANDING_MOTION.entry.morphFrom` (.7 of the drift, ~.8 of the
way there) and leaves on a sine out, so the wash is visibly turning into its
vessel over the last stretch of its move; the fill still ends at
`unfoldEnd − 300`. Tuned in the "landing" panel's entry folder (`morphFrom`,
a new key, so an old persisted `seatFillFrom` no longer applies).
Then in two beats: from `morphFrom` the wash first spreads out from the
middle of its seat to the vessel's outline over `entry.formMs` (1 s; a ragged
wet edge running out, the wash swelling to `formSwell` .85 of the box and
draining into it), pooling at the border so the outline is drawn with only a
pale wash inside; once that is done the paint fills from the foot as before.
`WashCuts.form` carries it; `uCut.w` runs 0 → 2 (form, then fill) so no
uniform was added.
No shrinking first (same day): a seated wash no longer gathers to a small
patch (`seatGather` .55 of the box, then spreading out from .2); it comes to
`entry.arriveAs` (.7 of its outline's box) on the way and grows out into the
outline from its own extent (the spread runs .3 → .8), swelling to
`swellTo` (1) of the box. Cutouts form larger too: `INK_CUT_SCALE` .7 (was
.5) of the seat, so the vessel grows from .7. A wash bound for a far seat
(~100 px) still has to come down from its landing size (~320–620 px) on the
way; it does so as it travels, not as a separate step.
The outline before the fill is a thin, faint line (same day): only the outer
part of the border (`thin`, where the mask is under .25–.6) at about half the
fill rim's weight over a .12 inside, and it takes only .35 of the cutout's
firmer edge and a small share of its tide boost; the full rim and tide line
come with the rising paint (`firm`, the fill's own share).

## Cutouts fill from the edge in as they rise (2026-11-11)

Enter's cutouts fill two ways at once (`WatercolorField`, the wash shader's
cutout block). After the faint outline forms, over the whole fill the paint
closes in from the outline's outer edge with a wet, ragged front until the
outline's own band (the softened mask under `EDGE_FILL_TO` .72) is full,
while it rises from the foot as before (briefly the band came first, over
the fill's first .35, and the rise after it). The band's inner side is
washed out: it thins over `EDGE_FILL_FEATHER` (.3) toward the middle, and only
its outer part firms the wash's edge and tide line, so it draws no second,
inner contour. The first outline is thicker (`OUTLINE_BAND`, the softened
mask .4–.85, was .25–.6) and its inside holds a little more paint, evenly
(`OUTLINE_INNER` .22, was .12; the look's paper tooth lies over it); until
the fill starts that inside is one even tone top to bottom (`OUTLINE_SHOW`
.6 of its colour), easing to the filled cutout's washed-out top (.08) as the
paint comes.
Before, the paint rose
from the foot at once and the border was only the faint outline until the
front passed it.

## The gallery's caption a little lower (2026-11-11)

The caption block under the vessel in hand (name, year, transcript) sits 1.5%
of the screen's height lower: `CAPTION_DOWN_VH` .075 in `PuddleDiveGallery`
(was .06). The transcript still stops above the timescale and fades there.

## Naming: a wider name, the words closer (2026-11-11)

The naming step's name field may grow to 40em (`--naming-field` in
`PondNamingOverlay`, was 28em; still within 70vw and the screen less 40px),
so a long name is not cut off. The air between the year and the transcript is
20px (`NAMING_TUNE_DEFAULT.layout.fieldGap`, was 28).

## The landing's text in dark grey (2026-11-11)

The landing's centre copy and Enter (with its 滲む nijimu) are dark grey,
`LANDING_TEXT` #45454a in `BlobScene`; the memories' captions and dots, outside
that group, are a lighter grey, `CHROME_GRAY` #7e7e86 (`LANDING_INK`)
(the copy was #2A2018, Enter #504A4A; the captions were white in
`difference` with a `saturation` pass over them, an inverted grey that
changed with the washes; both blend layers are gone, the captions now draw
in normal blending). Enter's mark still eases to `CHROME_GRAY` through Enter.

## The landing's copy sooner (2026-11-11)

The centre copy and Enter were held until the washes' opening was 80% done
(~6.8 s, then a 1.4 s fade). They now come in at `LANDING_MOTION.reveal.copyAt`
(.45 of the opening, ~3.8 s; WatercolorField's `onSettling`), tunable in the
"landing opening" panel's rhythm folder; the captions follow the copy as before.

## The array a little higher (2026-11-11)

The gallery's rim sits up to 2% of the screen's height higher (`carouselLift`
in `lib/carouselLayout.ts`, `CAROUSEL_LIFT_MAX` .02 — briefly .03: the memory
in hand at .47 − lift of the height, was .47). It rises the full lift where
there is room; on a short window only as far as keeps the memory in hand (its
seat × 1.08) clear of the "keep scrolling" tip (14.5vh, ~40 px, 10 px air), so
a 1440×700 window stays as it was. Everything that reads `carouselFrame`/
`carouselSeat` follows (the ink hand-off, arrows, wash, constellation), and
the caption block (name, year, transcript) rises by the same lift so it keeps
to its vessel. The block itself sits 2% of the height higher under the vessel
than it did (`CAPTION_DOWN_VH` .06 in `PuddleDiveGallery`, briefly .08; .07
before that): at 1440×900 the name is ~18 px nearer the vessel's foot. `check-carousel.mjs` asserts the lift and the tip clearance
(it still stops later at its older "incoming dot depth scale" assertion).

## Far cutouts no longer boxy (2026-11-11)

The ink entry's cutouts are drawn on the wash's paint grid (`dyeLong` 272,
~10 device px a cell), and the composite thresholds a bilinear read of it, so
outlines were chains of straight facets; a far seat's cutout, a few cells
across, came out as stepped slabs. Two halves of a middle ground in
`WatercolorField`: COMPOSITE3 reads the paint through a cubic B-spline
(`smoothTex`, four bilinear taps), a sub-cell softening of the field, not of
its edge, so contours are curves; and while the entry runs the paint grid is
`ENTRY_DETAIL` (1.5×) finer, the paint carried across the change (`COPY3`),
not restarted. Frame pacing through the entry measured unchanged on an M1
Max; the wash pass costs ~2.25× for those seconds.

## A lighter first load (2026-11-11)

Measured on the production build (headless Chrome, 4G): a first visit
fetched ~11 MB in its first seconds, 7 MB of it the soundtrack. Now ~1.7 MB.
The soundtrack (~9 MB, jsdelivr) is fetched only once the music is turned on
(`soundtrack.ts`: no player until then; muting pauses it). The landing no
longer mounts the old gallery-morph `SceneViewer` while hidden (it pulled
three.js and drei's "city" HDRI at once) nor `GooeyBlobCanvas` (a hidden
WebGL2 context, 3 shaders and a full frame in a layout effect); the header
tick no longer samples the washes' luma (90 rect reads a frame, discarded).
The gallery stills are WebP at their full size (q85, ICC kept; 3.4 MB → 1.0
MB, SSIM ≥ .97), and their preload waits 5 s past the chunk's load, then
idle, so their decode stays out of the landing's opening. Production
canvases (seats, pond, descent) set `gl.debug.checkShaderErrors` from
`SHADER_CHECKS` (dev only). Still heavy, not yet done: one WebGL context per
gallery seat (~7 programs and its own uploads each), cloth builds on the main
thread at Enter, seats rendered at full box size whatever their scale, the
landing's Enter held for its ~6.8 s opening, and BlobScene re-rendering
every frame. `.claude/launch.json` has `prod-preview` (vite preview, 4173).

## One paper finish past Enter (2026-11-01)

Everything but the landing wears the gallery's grain and tooth
(`lib/paperFinish.ts`, `components/PaperFinish.tsx`). The fine grain is
white noise, one grain per device pixel, ±`PAPER_GRAIN`/2 (.035): the
gallery's puddle shader adds it (the reference); the pond stage in
`LandingPage` (pond, recording, transcript, descent, naming) lays it as two
DOM tiles (white in `plus-lighter`, black over, `FINE_MATCH` .9 measured
against the gallery: σ ≈ 2.5 levels on both), so the pond's and the
descent's shaders no longer add their own (pond `grain` 0, which now adds on
top). The tooth is the gallery panel's `texture` (140 px, soft-light .12),
read live, so that panel tunes every screen past Enter. Glass panes and the
phone menu wear both off the landing (`onLanding()`); on the landing they keep
the landing's grain. Materials (film, ink, washes, glass) keep their own.
One place to tune it all: the "gallery ground" panel (backdrop grain = the
fine grain everywhere past Enter, texture = the tooth); the constants are
in `paperFinish.ts`. Phones (`LIGHT_TIER`) draw it finer and fainter
(`PHONE`: grain ×.55 at one grain per device pixel to 3×, tooth ×.5 at .7
of its size; σ ≈ 1.4 on a 3× phone). A way out if it costs too much:
`?finish=full|lite|off` (kept per device in localStorage `nijimu.finish`,
`?finish=auto` forgets) — lite is the darker half of the fine grain alone in
normal blending (one layer, no blend modes, no tooth), off removes the
finish and the landing's grain too. Unforced, `startFinishWatchdog` (in
`RootLayout`) steps full → lite → off after three 2 s windows whose median
frame is over 40 ms, logging it in the console. Headless/software-rendered
browsers trip it: force `?finish=full` when checking by screenshot.
To compare by eye (dev), the "gallery ground" panel's `finish` folder sets
the mode for the visit (`previewFinishMode`; "as is" restores it, and the
watchdog waits meanwhile) and, in the gallery only, `underVessels` lays the
finish over the water alone instead of over vessels and words (the descent
draws its vessel in the water's canvas, so there it stays over all). The fine
tile now follows the screen's real DPR (no 2× cap, which resampled it on a
zoomed page), and `PerspectivePond` (naming's pond) renders at `MAX_DPR`, not 1.5.
The apex vessel's canvas renders denser by its on-screen stretch
(`VesselArtifact` `pixelScale` = canvas room × library size × the apex swell
1.08 × focusBoost, up to 1.75 × `MAX_DPR`, 1.4 × on a phone): the seat is
measured unscaled (offsetSize), so a spiky, large form was drawn at its box's
size and stretched ~2× by its CSS scale — the jagged edges. Neighbours keep
`[1, MAX_DPR]`.
Every seat but the apex fades with its distance along the curve, either
side (`seats.fadeNear` .1 at the next seat, easing to `seats.fadeFar` .2 by
the third; `adjustCurveSeat`, on top of `carouselSeat`'s own opacity), tuned
in the "gallery" panel's seats folder.

## One ramp of grounds (2026-11-01)

`lib/atmosphere.ts` holds every scene's ground in journey order — paper
(#f4f5f5 → #ecebeb), the gallery's ground (#edecec), the pond, under the
water (`UNDERWATER`, ≈ #e2e6e5, printed into the shaders as
`UNDERWATER_GLSL`), the sink wash, the surface light / naming (#f4f6f5).
The temperature shift is deliberate (warm paper → grey-green water), each
step small. `landingLook`, `galleryTune`, `pondTune`, `pondCamera`,
`landingReturn`, `LandingPage`, `PerspectivePond` and the descent read it;
change a ground there, not in a literal. The pond, which had gone steel-blue
(near water #b6c3c7), now leans grey-green: sky #eeefef → #e4e8e6 →
#c6cccb, water #e6e8e8 (was #e7e8e5), natural #d2d9dd (was #e3eae8, now a deeper, cooler foot), shade #d5dadd, warm light #eee8e6; clarity .55, sharpness .92, haze from 36, clouds .132 (near water ≈
#bac2be). The transcript's foot fades by a mask on the words, not a
coloured block over the water.
Under the water leans cooler with it (2026-11-01): `UNDERWATER` [.884,
.901, .911] ≈ #e1e6e8 (was [.888, .902, .897], grey-green) at the same luma,
so the pond above, which keeps only its lightness, is unchanged; `SINK_WASH`
#e4e9ec (was #e3eae9), now also the ascent's last handoff on the glass
(`SINK_WASH_GLSL`, was a literal). With the sample memory, "record again"
waits for continue and shows with it; a recording's shows with the words.

## One memory fewer (2026-11-03)

"Met someone through a screen" (id 12) is gone — its event, transcript,
highlights, feeling, tone, still (12.jpg) and library row. Fifteen curated
memories remain; ids are not renumbered (13–15 keep theirs). `LIBRARY_SIZE`
is `LIFE_EVENTS.length`, a still is found by the memory's id (`13.jpg` is id
13, `memoryPhoto`), and the E-NN shapes are named by id, so nothing after the
gap shifts. A library kept in /lab/shapes with sixteen rows no longer loads
(the built-in one is used). Memory 07 is now "Heard the music, not the
practice" (the piano), in place of "Wrote something true for the first time".

## Shape carries into Rhythm (2026-11-03)

Entering Rhythm no longer lifts growth to .6 whatever Shape chose: only a
Shape step left untouched (growth under `RHYTHM_UNSHAPED` .05) is revealed to
.6; any growth the hands set is kept (`rhythmMorph`). The thumb–index pinch is
read relative to the hand as it is first seen (`createRhythmPinch`'s offset,
`live()` for the hold): whatever gap it arrives with stands for the current
m2, so a hand still spread from Shape no longer drives m2 to 16.
Comfort softens more (`SHARPNESS_RULE.comfort` .4, was .15; `MAPPING_VERSION`
memory-form-v4): a warm, comforting memory read as intense (designX: comfort
.9, intensity .7) lands among the soft bowls (Y-17) instead of the urchins
Y-16/Y-18 (the stacked "saucer"); very intense joy (.95) still reads floral.

## DialKit panels start folded (2026-11-02)

Every DialKit panel (landing, gallery, pond, naming, film, studio) opens
folded; a tap on its header opens it. `DIALS_OPEN` in `lib/dialsOpen.ts` is
the one switch: `?dials=open` opens them expanded, `?dials=closed` folds
them, kept per device in localStorage `nijimu.dials`; `?dials=auto` forgets.
The studio is the exception: its two panels open expanded unless
`?dials=closed` was chosen (`STUDIO_DIALS_OPEN`).

## Vessel studio (2026-11-02)

`/studio` (`src/app/studio/VesselStudio.tsx`, `studioSettings.ts`) is the
vessel alone, apart from the experience (outside `RootLayout`: no header,
music or gallery; nothing set there reaches another screen), to tune its 3D
look and export it. It draws with the gallery's own `VesselArtifact`
(refraction, draped strip, film look, reflection, sheen, stain), opening on
`VESSEL_GALLERY_TUNE` and the gallery's room/reflection/sheen. Two DialKit
panels (`productionEnabled`, persisted as `nijimu-studio*`; DialKit's version
menu keeps presets): "studio" top left — a gallery memory to load
(`galleryStateFor`), the form (category, "draw", morph, both superformula
sets, proportion), photo (stills or upload), glass/sheet/face modes, view,
frame (aspect, size, offset), backdrop, export — and "vessel" top right, every
`KNOBS` group from `VesselPreview` (now exported, with `TEXTURES` and
`FORM_SLIDERS`) plus room, film (`setFilmTune`), colour, reflection, sheen.
Export: a PNG of the frame at a chosen long side, with the backdrop or
transparent — the vessel's canvas is re-rendered at that density
(`VesselArtifact` `dpr`, and `capture`, which copies the next complete frame
with its reflection) and composed onto the frame; settings as .json
("import settings…" reads it back); "copy tune diff" puts the keys moved off
`VESSEL_GALLERY_TUNE` on the clipboard. The studio raises the seat photo
size (`setSeatPhotoMax` 2400, was fixed at `SEAT_PHOTO_MAX`).
Two sheet knobs came with it (every vessel; built values as defaults):
`tornDepth` (× the torn ends' 1.4 mm, `uTorn`/`uTornOn` in `stripTornOutline` —
a material without them keeps the built tear) and `edgeFade` (the photo's
window thinning into the stock, mm; was the fixed `SHEET_DEFAULT.edgeFade` 2.5).
The teeth seen at a fitted strip's sides on a round form were not the tear:
the cloth settle held every cell at its length against squeezing too, so
where the strip follows a narrowing wall it buckled into accordion pleats,
seen edge-on at the silhouette. `gather` (drape; `Drape.gather`, in the build
key) lets squeezed cells give way instead (still resisting stretch): 1 is
smooth, .5 still shows faint teeth. 0 as built everywhere but the studio (1).
Kept vessels: the "studio" panel's "saved" folder (name, save, pick, load,
delete) keeps every setting with its photo in IndexedDB (`nijimu-studio` /
`vessels`, `studio/savedVessels.ts`) — the photo as a Blob, fetched from
whatever it was shown from, back as a data URL — so a kept vessel survives a
reload and a rebuild. Saving under a name already kept replaces it. The
downloaded settings .json now carries its photo as data too.
Tuning a gallery vessel in the studio (2026-11-02): load a memory, tune it,
"copy for gallery" (source folder) puts that memory's library row on the
clipboard — form, morph, picture place/size, view, the look keys moved since
loading (`tune`, a new optional `ShapePlacement` field laid over
`VESSEL_GALLERY_TUNE` for that vessel alone, in `entrySignature`), its foot
colour (`tone` → `GALLERY_TUNE_DEFAULT.tones[id]`; a tone's own `ownFoot`
lets one memory keep its own foot tone) and any change to the stain's shape
(`footShape`, one for every vessel). It is written into `TUNED` in
`lib/galleryLibrary.ts`; a library kept in /lab/shapes still wins over it.
The "gallery colours" panel persists, so its key now carries a hash of
the code's tones and foot (`COLOR_KEY` in `GalleryDials`): a tone changed in
code is no longer covered by colours the panel kept before.
The studio's backdrop now opens on `gallery`: the gallery ground's colour,
its vignette and the paper finish over the whole page, read live.

## Vessel film panel (2026-11-01)

The warm yellow above and below a vessel's photo is the film look: the light
leak (`dyeLeak` .72, an orange-cream lobe from one side and a hot spot — on
the upright strip, above or below the picture), the crossover's cream
highlights (`split`), the cream bloom and the orange halation. A "vessel
film" DialKit panel (dev, `components/FilmDials.tsx`; the descent while a
vessel is in hand, bottom right; naming, bottom left) tunes them for every
vessel through `lookFor` (`lib/filmTune.ts`): `leak` (× dyeLeak), `cool`
(how much of the warmth goes — `uFilmCool` in `FILM_LOOK_GLSL`, 0 as built),
`halation`, `split`, `bloom`. Defaults are the look as built.

## Naming panel (2026-11-01)

Naming has its own DialKit panel (dev only, `components/NamingDials.tsx`,
mounted lazily by `PondNamingOverlay`), "naming" bottom right: layout (the
vessel's lift in vh and scale, the words' lift, the field and passage gaps),
the room the glass reflects, and its light near & clear / far & faded.
`lib/namingTune.ts` holds `NAMING_TUNE_DEFAULT` (the overlay's former
constants). The vessel now sits 6vh up (was 3vh), so its crown stands over
the horizon.
Naming's water is the recording's: it already shares `POND_TUNE_UNIFORMS`
(through `createPondPigmentUniforms`), lens and settled camera; since
2026-11-01 it also dissolves into the sky at 140–400 units as the descent's
`waterFragment` does (was 600–1400), and the white radial light that
`MemoryPondPage` laid over naming alone (#fff9 at 48% 24%) is gone.
The vessel is mirrored on the lake (2026-11-01): the gallery's planar mirror
(`VesselReflection`, the plane `gap` under the foot) with `water` set, which
adds one full-canvas pass (`waterReflectFragment` in `VesselArtifact`) over
the blurred mirror (`smear`: longer down than across). Each pixel finds the
water under it through naming's pond camera, takes that pond's own wave
normal (`pondSurfaceNormal`, its uniform objects shared by reference — same
clock, rings, touches, knobs), bends the reflection by twice the slope
(`ripple` 1 is physical, `stretch` foreshortens it down the screen) and
weighs it by the water's Fresnel (`fresnel`: strong toward the horizon, clear
near the eye); nothing is drawn above the pond's horizon. The pond lends its
surface while mounted (`lendPondSurface` in `lib/namingWater.ts`); without it
there is no reflection. The gallery passes no `water` and is unchanged. The
naming row of actions sits over the taller canvas (zIndex 2).
Where it lands it falls clear, as the still mirror did: within `contact`
(share of the canvas) under the waterline the pass blends the sharp mirror
(kept beside the blurred one) over the soft, unbent (`contactSharp`) and at
least `contactStrength` whatever the Fresnel. The vessel reports that landing
point on the screen (`onContact`), and the lake centres on it: a spot in the
foot's own tone (the glass's foot band, l −.1, chroma ×1.25; the water's
shade with no colour), laid in as a dye and moved by the waves (`spot*`),
with the memory's hue spreading round it.
The memory's colour reaches the lake round the reflection
(`lib/namingWater.ts`: `NAMING_WATER_UNIFORMS` spread into naming's pond
material, `namingLake` in its shader): a filter evened to its own luma, so it
turns the water's hue and leaves its lightness, strongest in an ellipse at
the seat's foot and thinning out, with a faint `wash` beyond; a grey pick or
one within `guard` degrees of the water's own hue (`POND_NATURAL`'s) gives
nothing. PondNamingOverlay writes its place each frame and eases it with the
vessel's appearance and lift; it is cleared on unmount. Both are folders of
the "naming" panel ("reflection", "lake"; `NAMING_TUNE_DEFAULT`).

## Pond panel and its light (2026-11-01)

The pond has its own DialKit panels (dev only, `components/PondDials.tsx`,
mounted by `MemoryPondPage` while the pond is in front): "pond" bottom right
(sun, surface, waves, rings, sphere, light, sky) and "pond ink" bottom left
(drops, ink, tone). `lib/pondTune.ts` holds `POND_TUNE_DEFAULT`; its shader
knobs are shared uniform objects (`POND_TUNE_UNIFORMS`, spread into every
pond wave uniform set and the cursor sphere's), read in GLSL through
`TUNE(built, knob)` macros declared at the head of `POND_WAVES_GLSL`, so a
material without them (uTuneOn 0) keeps its built values. The settled look:
a softer, wider sun path (sun .7, glow 1.63, sharpness 147, path 8 × 28.5);
highlights ease toward .975 (`shoulder` .85) instead of clipping; warm light
(#eee9e8) and cool shade (#d7e0e8) laid back over the grey; the rings' light
.76 and a little warm; a cooler grey (paper #e4e8e9, natural #e2eced, sky
#ebeeee → #e1e5e6 → #bfc6c8, `pondBackdropCss`) with a soft glow over the
horizon where the sun's path begins, so the light in the water has a source.
The pigment drops, their ink and the water's stain are off by default
(`drops.show`, `ink.show`, `tone.show`); the prompts' ripples still come.
The floating questions' words are off by default too (2026-11-02, the
"pond" panel's `prompts` folder: `words`, `ripples` — ripples kept on).

## Landing opening and look panels (2026-11-01)

Two DialKit panels share a shell at the landing's top left (dev only,
`LandingDials`). "landing opening" holds the washes' arrival, moved out of
the "landing" panel's timing (its old "washes arrive" folder is gone):
order (`LANDING_MOTION.opening.order`: random, light/dark first, centre
out, edges in, left to right, top to bottom; `scatter` loosens it,
`inViewFirst` puts what is on screen first), rhythm (`firsts`, `second`,
`restFrom`, `lastStart`, `pace`, `jitter`), growth (`ease`: smooth, bleed,
soak, linear; grow/fade times; the free washes' reach) and the shape a
wash opens with (`roundFrom`; `openWarp`, a wandering edge while it opens,
`uOpen`/`uOpenWarp` in the wash shader; `openDrift`, opening off-centre and
flowing over; `wetDeep`, deeper while wet). "replay" runs the opening
again. "landing look" is `lib/landingLook.ts`: a CSS filter on the
landing's root, a tint and a pool of light (plus a flat veil) in blend
modes, eased to neutral with the paper through Enter; it also holds the
paper under the washes (its own layer: a gradient #f4f5f5 → #ecebeb, was a
flat #e4e4e6; the gallery's ground is a step under it, #edecec, was #eae9e9,
and the grounds between — the shared layout's #edecec, the return veil
`LANDING_PAPER` #efeeee — sit between the two, so Enter and the return cross
a little rather than jump), the grain (overlay .48), the vignette (#c4b8b5 at .105, was
black .2). The three ambient lights that drifted under the washes
(teal, pale cyan, peach) are removed (2026-11-02), landing and Enter alike. Brightness is 1.01; the rest of the
filter, the tint and the light are neutral; the opening is as built.

## Gallery reflection and sheen (2026-11-01)

Each gallery vessel has a soft mirror image under its foot and a studio sheen
on its glass. Both are tuned in the "gallery" DialKit shell (folders
"reflection" and "sheen"; `GalleryTune.reflection`/`.sheen` in
`lib/galleryTune.ts`) and passed to `VesselArtifact` as `reflection` /
`sheen`. Naming, export and the labs pass neither, so they are unchanged.
The reflection repeats the glass and strip, mirrored at `glass.lo - gap` on
their own layers (3 sheet, 4 glass). It is rendered into its own target,
blurred (`soft`, CSS px), and laid into the refraction frame before the
vessel's strip, so the facing glass refracts it too. It fades by
`uReflectFall` (new in `REFLECT_GLSL`; the lab keeps 1.3). The canvas is
`1 + room` times taller than its seat and the lens keeps the seat's framing
(`setViewOffset`). Presses in that extra room are ignored. The first frame
(the landing's ink outline, `captureInkMask`) is drawn without the reflection
and cropped to the seat (`data-seat-share`). The sheen is `studioSheen` in
`GLASS_COMMON_GLSL`, refraction look only: a lobe fixed to the eye (x/y on
screen, size, softness, rim, tilt), its core colour easing to an edge colour,
drifting by speed/wander and breathing. With amount 0 it is neutral.

## Pigment drops on the pond (2026-10-31)

The pond's prompt ripples are no longer spontaneous: each is made by a drop
of the landing's paint (`POND_PIGMENTS`: `LANDING_TONES` without cloud, a
fixed walk per visit) landing on the prompt's place
(`components/PondPigmentDrops.tsx`, mounted by `PondWater`). The drop is
drawn flat in screen space, as the landing's cutouts are: a slim teardrop of
the paint's deeper tone (`POND_PIGMENT_DEEPS`, the vessels' foot-band tone;
narrow foot, straight sides), no light, a soft wandering
edge, sized as a drop would be where it lands, a little soft-focused (`uSoft`, ~.8 px + .22 of its size) and
motion-blurred back along its way by its speed (`SHUTTER_S` .025 s, 12
taps, a soft gain keeping its body whole). It does not vanish at the
surface: for `POND_DROP_SINK_S` (1.1 s) it is seen going down to the ink's
head — placed where the shader draws that head, down the refracted ray,
let hang — checked by the water at once (it rounds, its smear goes),
swelling, softening and thinning while the ink comes up round it. The ink
starts from the drop's own size; `inkHead`/`inkSpread` (a quick plunge, then
the slow sink) are written once in TS and printed into the shader, so the
two meet. It comes in on a slant, `POND_DROP_ANGLE_DEG` (−18: 18° anticlockwise
from the top of the screen) — down from above, leaning in a little from the
left — from off screen, at one even speed (`dropTravel`).
It lands as the cue's ripple begins: the cue's clock starts at
`-POND_DROP_FALL_S` (1.5 s) so the first drop has fallen, `pondPromptCue`
takes negative elapsed (age counts down to the landing) and reports `cycle`.
The landing leaves ink (`lib/pondPigment.ts`, `POND_PIGMENT_GLSL`, applied in
the above-water branch of the descent's `waterFragment` and in
`PerspectivePond`'s own shader): a surface bloom and, seen through the
refracting surface, five upright slices of a plume — a head rolling into two
curls, the column behind it, tendrils, and two strands of threads drifted
apart so the trace folds over itself. Every strand, slice and plume is laid
over the water as multiply, so overlaps within a plume and between plumes go
deeper and mix; deeper ink pales toward clear (`inkDepthTone`). The ink
wears the landing washes' paper tooth (`POND_INK_GRAIN` 2.2 at
`POND_INK_GRAIN_PX` .62 px, a little finer than theirs, the same three turned octaves of screen-space
noise as WatercolorField's look, lifting and thinning its cover), and it
blurs as it fades (`soften`: its shapes widen keeping their weight, its
threads run together) — only late in its life: with time from 50% to 92%
of it, and, from 40–65% of it on, where it has sunk to just above where it
thins away. A young plume stays sharp all the way down. The ink is the
paint thinned in the water, a lighter, quieter tone of it
(`POND_PIGMENT_LIGHTS`: l +.2, chroma ×.7). It opens wide
but stays in frame (`POND_INK_SCALE` 2.5, spread to ~.75 model units; the
shader's bounds sit well past the curls and the late blur so no edge is cut) and sinks steadily through
its life, thinning away between depths `POND_INK_FADE` (1.3–2.15 model units); the surface's slope bends it, more the
deeper it lies, and the water is let be clearer over it than its own fresnel
(`clear`), so the trace can be followed. It hangs `POND_INK_HANG` (1.6×) deeper on
screen than true for the nearest prompt (`POND_INK_HANG_NEAR` 14 from the
eye), and farther plumes longer by (distance / 14)^1.3 up to 1.8×
(`inkHang`), since the same depth looks shorter the farther off it is: every
plume goes about as far down the screen, ending near its foot. A longer hang
draws the threads finer down the slice (`stretch`), so it shows more of them
rather than smearing them so it reads falling from this low eye; four round-robin
slots (`uInk`/`uInkTint`), `POND_INK_LIFE_S` 20 s at most. Each landing stains
the water up the screen, after the vessels' tint (`uPondTone`,
`uPondToneDeep`): one gradient with no band, a filter strongest at the foot
of the screen (`POND_TONE_STAIN` .18, faint) in the paint's deeper tone (l −.1,
chroma ×1.25, `POND_PIGMENT_DEEPS`), easing into the tone itself and
thinning smoothly to clear by 55% of the height. The tint holds until the
next drop has landed and spread, then crossfades to that drop's: it waits
`POND_TONE_DELAY_S` (2.6 s) after the landing and crosses over
`POND_TONE_CROSSFADE_S` (3 s, `pondToneCrossfade`; the first one simply
comes in), so one colour
replaces the last and they never accumulate. The rings glow white on their
crests, the light gathered in broad soft swells round each ring rather than
broken glints, with a shade in their troughs (`rippleLight`), for touches too
(voice pulses at .45). The cursor's mark is no longer a ring: a small glowing
white sphere (`sphereVertex`/`sphereFragment`, radius `SPHERE_RADIUS` .045)
resting in the water — not floating, no shade — riding the swell and passing
rings as one body, its foot under the surface (depth-tested), with a soft
eye-facing glow round it (`glowVertex`/`glowFragment`). It is evenly white,
unshaded. A press pushes it most of the way under and holds it there until
let go (`uTap` pinned while `holdRef` > 0), its glow dimmed, and while held
it goes on stirring the water as one continuous train, not ring by ring:
`holdWave` in `POND_WAVES_GLSL`, driven by `uHold` (x, z, when the hold
began, when it was let go — far ahead while held): each point carries the
wave sent out when it was reached (`HOLD_WAVE_SPEED` .6, `HOLD_WAVE_LENGTH`
.34, `HOLD_WAVE_HEIGHT` .032), so it spreads evenly and goes on outward after
release; `rippleLight` lights it too. Its glow is faint (.3/.12); "Hold to
begin" sits beside it. A press on the pond is a gentle, slow ripple: strength .7,
marked slow (`PondTouch.slow`, encoded as strength + `POND_SLOW_DROP` 10 in
`uDrops`), so `rippleField` and `rippleLight` run its train on a clock at
`POND_SLOW_PACE` (.65) of the pond's. Prompt drops and
voice pulses keep their pace. All of it is gated by `uPondLife`,
which `PondPigmentDrops` raises while mounted and zeroes on unmount, so the
descent's later shots are unchanged. Reduced motion keeps the earlier still
ripple, no drops, ink or tone.
The water seen from above wears the page's grey, not the old grey-green:
`pondAboveColor` keeps its light and shade but takes `POND_PAPER` (the
landing's #e4e4e6) as its colour and keeps only `POND_SHADE` (.45) of
whatever darkening falls below it (its highlights whole), and the page behind the pond (`MemoryPondPage`,
the descent host, the still fallback) is `POND_BACKDROP`, the same grey.
Over that grey the water keeps a faint natural tint of its own
(`POND_NATURAL`, a cool blue-green multiply): full where the eye looks down
into it near at hand, clear where it only mirrors the sky, read from the
eye's angle so it lies still under the waves. The
water under the surface keeps its own palette. The surface's wrinkles
(chop, grain, light fibres in `POND_WAVES_GLSL`/`POND_SURFACE_GLSL`) run at
about .6 of their former frequency, for the whole pond.

## Fixed landing field (2026-10-30)

The landing (`BlobScene` with `classicChrome`) uses a viewport-sized field and
caption layers. Dragging, touch gestures and wheel input do not pan it; its
blobs and captions retain their ambient animation. Legacy blend previews keep
their existing larger field and movement controls.
Landing caption boxes are measured against the viewport with a safe zone
(`LANDING_CAPTION_SAFE`: 6% of the width at the sides, 8% of the height top
and bottom, 28–72px; was a flat 20px);
long titles wrap, and their text and dots shift inward as the washes drift.

The landing's washes (`WatercolorField`, tuned live by the "tune" panel,
`WashTunePanel`/`lib/washTune.ts`, kept in localStorage `nijimu.landing.wash`)
wear the colour step's tones: `WASH_TONES` in `BlobScene` samples
`lib/homePaletteField.ts` per `MEMORY_COLORS` slot (cloud is mist's pale top;
the second slate is the field's purple at .8 chroma). A cursor stroke thins
the paint under it (`wipe`, "paper drawn in", 1.05× the brush, in streaks
continuous along the stroke) so clear paper
is carried into the washes; tide lines are drawn only near a wash's resting
rim, never where stirred paint thins inside one. Paint stirred while the
washes open follows them with a 0.3 s lag (`GROW_RELAX_S`) instead of snapping
back when the stirring stops. Wash centres keep `BLOB_MIN_GAP` (12% of the
field) apart, so fewer pool into one field. About a third
(`BLOB_EDGE_SHARE`) are centred on the frame's edge, roughly half outside it.

Enter's ink entry no longer turns the washes into dots, and the washes keep
living through it (flowing, joining, stirred by the cursor; the paint only
returns faster, `ENTRY_RELAX_S`). Each memory the gallery shows on screen has
a mask waiting at its seat — its vessel's outline at `INK_CUT_SCALE` (.7) of
the seat, softened and wandering like a wash's edge — and its wash drifts
there and fills it with its own paint from the foot up, an uneven wet front,
draining into it as it does, nearest the focus first; the other washes close
where they lie the way they opened (`WashCuts.open`: a round one shrinks away,
a free one fades through its ink; `CLOSE_MS`, staggered over `CLOSE_SPREAD_MS`,
all gone before the first fill), so the screen holds as many as the gallery. A seated wash
runs into its vessel's own colour as it drifts (the memory's colour pick,
which stains the glass: `feeling` or `look.oklch`; `WashCuts.paint`/`tint`),
and its cutout keeps its colour to a band low down (from about .45 of its
height, deepest toward the foot), washed out above it as the glass is; its border is mostly spared that
fade, so the outline reads all the way round. A
wash with no seat once the gallery has placed any (it seats only those near
the focus) is one of these. A seated wash drifts there in `SEAT_DRIFT_MS`,
coming to `arriveAs` of its outline's box; while still moving (`entry.morphFrom`,
.7 of the drift) it spreads out to draw its vessel's outline (`formMs`), then
the paint fills it from the foot, the wash itself spent once the outline is
drawn. A cutout's edge is firmer than its wash's, with pigment pooled
at the border and a stronger tide line, so the outline reads. The fill pools
deeper at the border in blotches, is denser low and clearer through its top
half, as the vessels are (`WashCuts`, uCut/uCutB/uAtlas in the wash shader).
The gallery tells the landing where each seat will finally sit and keeps the
outline of its vessel's first whole frame (`lib/inkCutouts.ts`, via
`ArtifactSeat.onFrame` → `VesselArtifact.onReady`); a mask with no outline yet
is a soft disc that eases into it. The vessel grows from its cutout's size,
fading in over 0–75% of the growth while the cutout fades across all of it.
Reduced motion and the no-WebGL fallback keep the earlier dot entry.

## Gallery artifact width cap (2026-10-30)

Gallery transcripts no longer follow the cursor. On wider screens,
`PuddleDiveGallery` reveals the centered full transcript after the selected
artifact has rested at the apex for `timing.transcriptDwellMs` in `galleryTune.ts` (1 s; 3 s until 2026-11-11). The transcript and the "keep scrolling" tip share one size, `GALLERY_TRANSCRIPT_SIZE` (0.9vw, 12–13px; the transcript was up to 14, the tip a fixed 12). The tip's leading is 1.5, the transcript's 1.45 (was 1.4); they share tracking `GALLERY_TEXT_TRACKING` (.01em since 2026-11-25 — briefly .015em — in em so each takes it in proportion to its own size — the tip sits at the wordmark's size, `PAGE_HEADER_MARK.fontSize`; was .006em, and the tip had lost it; the transcript was +.012em at 1.4, the tip untracked). The memory's name (`CAPTION_TITLE_STYLE`, shared with naming) is clamp(12.5px, 1.015vw, 15.5px), was clamp(13px, 1.05vw, 16px).
Switching memories, entering constellation view, or leaving the gallery cancels
and resets the delay. The existing word/line entrance remains; phones retain
their tap-to-read pane. `TranscriptTrail.tsx` is no longer mounted by the gallery.

Gallery vessels fit within 100% of their allocated seat width, before the extra
canvas room for superformula spikes or the library's size multiplier.
`GALLERY_VESSEL_MAX_WIDTH` in `lib/vesselFraming.ts` is the shared limit.
`VesselGalleryProvider` converts it to the expanded canvas's fraction and
`VesselArtifact` pulls the camera back only when needed. A fixed geometry bound
accounts for perspective and hover bob, so turning a vessel never pumps its
scale. Naming and other consumers retain their existing framing. Run
`node scripts/check-vessel-framing.mjs` for projection checks across shapes,
aspect ratios, library sizes and orbit angles.

The capped gallery's centre is enlarged 6%, easing out before adjacent seats.
The first newer seat is 13% smaller and the second 45% (`adjustCurveSeat` in
`VesselGalleryPreview.tsx`), stepped out by 2% / back in by 2.5% of the width
and down by 4.5% / 5% of the height; smooth offset weights preserve scrolling and the
phone's additional clearance. These, the vessels' foot stain (gallery strength
.21, foot .47, flash .85, one fixed tone per curated memory), the room
(#eae7e6 / white) and the gallery's timings live in `lib/galleryTune.ts`; in
development `GalleryDials` tunes them live, in three separate DialKit shells
while the gallery is in front (`DialRoot`'s `panels` filter is our pnpm patch,
`patches/dialkit@2.0.2.patch`): "gallery" bottom right, "gallery colours"
bottom left, "gallery ground" top left — the water's still colour, grain (and
its cell size), paper fibre and vignette (optional `PUDDLE_TUNING` fields read
by the puddle's render and dive passes; absent = as built), a noise texture and
tint laid over the whole gallery in a blend mode, and a CSS filter on
`PuddleScene`'s root (none while neutral). The landing → gallery ink takes each
vessel's tuned stain and foot (`galleryVesselTones`). The view toggle imports the root
`constellation icon.svg` and `timeline icon.svg` directly, fitting each within
14.2px (the create icon's visible extent) while preserving the SVG proportions.
Its hover labels use two centered lines: "constellation / view" and "timeline / view".
The desktop arrows share the create button's horizontal centerline, mirrored
on the left; phone arrow placement is unchanged.

## UI motion pass (2026-10-22)

Chrome motion follows the animation rules (press feedback, interruptible,
exits quicker than entrances); 3D/atmospheric transitions are untouched.
`motion.css` holds the shared press classes: `.nijimu-press` (scale .97 —
the `scale` property, so it composes with a positioning transform; PillButton,
the phone's round continue), `.nijimu-press-icon` (the header glyph gives,
not the button) and `.nijimu-text-button` (TextButton: mouse-only hover,
press, focus ring); `.nijimu-glyph-in` keys state glyphs (music, view) in.
The transcript printout is capped at `TRANSCRIPT_TYPING_MAX_MS` (8 s, pauses
scaled), any transcript skips on a click, and "record again" shows with the
words. Gallery arrow keys are paced like the wheel and leave for the pond only
on a fresh press once the rim is still. GlassPane uses transitions on
`data-state` (from/in/out), so a close or reopen turns round mid-way. Header
menu opens 200 ms / closes 150 ms; header names wait 300 ms the first time,
then neighbours show at once. PaneOption hover 240–280 ms. The spectrum knob
cross-fades two shapes by scale/opacity. The gallery caption's first line
starts its last word within 560 ms.

## Landing goo in WebGL (2026-10-26)

Safari skipped the landing's `filter: url(#gooey)` (animated, composited blob
divs under an SVG reference filter on a layer wider than its buffers) and
showed only the soft blobs. `components/GooeyBlobCanvas.tsx` now draws the
goo in WebGL2 in every browser: it reads each blob div's live computed box,
transform, `scale`, corner radii, blur and opacity per frame (the CSS
animations and BlobScene's JS stay the source of motion), rebuilds the
multiplied layer analytically, then does the filter's blur (σ 18), alpha
threshold (×22 −9) and `atop` composite in linearRGB. The divs stay mounted,
hidden. The SVG filter remains the fallback without WebGL2; `?goo=svg` forces
it for comparison. Phones (`lite`) are unchanged (no goo).

## Transcript review restored; highlighting archived (2026-10-11)

Recording and the sample go from `/record/start` to `/record/transcript`, which
prints the complete memory over the same mounted pond. “record again” returns
to recording; “continue” goes directly to `/record/descent` for the photo.
There is no select/drag-to-highlight step. The live screen is
`components/PuddleTranscriptPage.tsx`; the old highlighting implementation stays
in `archive/highlight-transcript/`. The transcript entry saves the words and
completion state so photo Back and reload restore the finished text. Failed or
lost real transcriptions offer “record again” and never substitute the sample.
The descent retains its transcription guard for older carried drafts.
Above the water the actions sit higher: `FLOW_PAGE.surfaceActionBottom`
(120px) for recording's stop/record, the transcript's "record again |
continue" (a fixed row, no longer under the last line) and naming's save
(shifted by `surfaceActionLift` so the naming vessel's rows are unchanged).
While recording, "recording · m:ss" is centred on the screen; the
instructions are one paragraph at the transcript's width (`TRANSCRIPT_WIDTH`). The
gallery trail still lets words fall behind the pointer without highlighted ink.
When the trail opens a memory's whole transcript under its year
(`CaptionTranscript`), its ink returns line by line (2026-11-11; it was a
line-by-line slide, then briefly a word-by-word blur): each line fades in,
ease in and out over `LINE_INK_MS` (1.6 s), `LINE_STEP_MS` (260) after the one
above, as a faint wash — a soft halo of its ink (`INK_HALO_EM`) held in the
paper's grain (`grainMaskTile` in `paperFinish.ts`: one grain a device pixel,
as on the landing, as an alpha mask), barely blurred (`INK_BLUR_PX` 1.1). A wet
front (`INK_FRONT`, a gradient 2.2× the line's width) then runs across from the
left, filling the ink in solid while the halo draws back into the letters
ahead of it (a word still haloed but already dark reads as a smudge). The
lines carry half an em of padding (taken back by margins; the paragraph is
`flow-root` so they do not collapse through it) so the halo lies inside the
mask. A settled line keeps no mask, shadow or filter (fill backwards).
Reduced motion keeps only the paragraph's fade. The overflow fade measures an
unseen copy at rest.

## Water surface continuity (2026-10-11)

The colour → naming ascent uses the pond's sun (`lib/pondLight.ts`), refracted
through the surface onto the vessel. `lib/ascentLight.ts` sequences incident
light, an interior ray, artifact radiance, bloom and final exposure. The ray
is integrated only inside the near glass silhouette, following the refracted
sun; it fills from the crown and broadens into the vessel glow.
It starts at 52%, fills by 84%, and holds its brightness through the surface
handoff; only the final scene exposure conceals it, avoiding a late light dip.
The environmental `CEILING_GLSL` retains the `b44c3bb`
`uwBreath`/`uwFolds` pattern, surface shading and body blend. Its shafts now
use 16 samples, 1.12 strength and a slow lateral drift, with the same 9-unit reach. The regular column pattern and added diffuse
atmospheric lift are removed. A faint 8% shaft precursor eases in during
colour; Continue grows it with a smooth 0–40% ascent envelope (2.6 seconds)
and a short damping filter, independent of surface texture timing. Artifact
lighting remains separate.
The highlight shoulder spans only the top .06 below white, preserving the
environmental shafts' contrast instead of compressing the whole pale water.
The glass and photo emit HDR light from their actual
lit faces. `lib/ascentBloom.ts` extracts those highlights and diffuses them in
quarter-resolution passes during ascent only, so the glow follows the rendered
artifact rather than a painted oval. The final exposure matches the naming
arrival's `#f4f6f5`; all light resets on rewind. Artifact emission begins after
52% of the ascent, easing in with a fourth-power curve and accelerating close
to the surface; the broad atmospheric wash now begins alongside it at 52%. Naming Back increases
artifact blur from 0 to 22px as the shared sink passes .74–.90, only after
entering the water. An interrupted arrival clears its remaining arrival blur
during the chrome fade before sinking. Check
both directions with `node scripts/check-ascent-light.mjs`.

The ascent's peak artifact radiance is .7 and the interior ray's gain is .45.
Light mixes gently toward the surrounding water's grey-green colour, with
only a small additive emission, so the glass contour survives until handoff.
The atmospheric wash eases in from 52–100%, capped at 32% opacity until
the final handoff to preserve the contour, in the water's
(.888, .902, .897) grey-green palette. Only the final 96–100% blends that tone
to the naming background. Bloom uses the water tone too; environmental shafts
lift the local water hue with bounded mixing instead of adding near-white. The `atmosphere` timing signal now controls only the post
pass's highlight adaptation; it no longer adds a diffuse water wash. Bloom spreads
more broadly at lower strength; an exponential highlight shoulder replaces the
hard white clamp so lit faces retain a smooth rolloff before the final wash.
The localized silhouette blur grows from 0 to 12px over 58–98% of ascent,
leaving the initial interior ray focused before its increasing light softens
the whole artifact. This reuses the arrival blur pass and never changes the
saved distance/frost value. The blur now uses two dense separable passes at
half resolution instead of a sparse 7×7 grid. Bloom also keeps its taps close
and diffuses over four passes, preventing replicated bright edges near the
surface. Its composite strength is reduced alongside the vessel emission.

`PerspectivePond.tsx` exports `POND_SURFACE_GLSL` alongside `POND_WAVES_GLSL`.
The pond, descent's top surface, and the overhead surface during the colour →
naming rise share `pondSurfaceNormal` and `pondSurfaceColor`: ripple/swell/grain
normals, wind-driven ribbons, clouds and the low sun. The overhead view mirrors
the eye across the water and reuses the same world coordinates and clock.
Seen from above (the pond, and the descent before the eye goes under) the
water also passes through `pondAboveColor` (2026-10-31, "clearer"): where the
eye looks down into it the body shows through a shade deeper with the swell's
shading 1.25× sharper, and the distance haze begins 18 units out at .011
(the live pond's was 8 units at .028, a fog over most of the view).
Its former independent `ceilingHeight` and extra surface caustic pattern are
removed. `underwaterBodyColor` supplies the same near-surface colour gradient
to the surface plane and full-frame volume. The overhead texture feathers into the same background over grazing views,
preventing a separate coloured band beneath the surface during the naming ascent.
During that ascent, the body stays opaque and the surface keeps its underwater
shading through the white handoff. The normal near-surface alpha/submerge blend
previously exposed the page background below while mixing in above-water colour
on the plane, creating two blocks in the last frames. The surface texture also
feathers into the body over a wider 0–.38 upward view-ray range.

## Gallery shape library (2026-10-11)

The 16 curated memories wear a library of 16 shapes (`lib/galleryLibrary.ts`),
in memory order. Candidates: E-01…E-16 (the shapes the gallery drew before the
Y series) and the 18 Y anchors. `/lab/shapes` (`ShapeLibraryLab.tsx`, LabDock
"shapes") picks 16, orders them, and sets per shape `size` (grows the seat
canvas, camera unchanged), `photoHeight` (sheet `anchorHeight`), `photoAround`
(degrees from the usual anchor; the seat still opens on the usual side via
`VesselState.facing`) and `photoSize` (× `fitSheetSize`). The still is `photo` (its place in the
sorted vessel-gallery set); with none kept, a memory wears the still it was
seated with, and one that never had one wears the first still — the same
picture `/lab/shapes` shows. It can lock the
camera (`view: {around, pitch}`: "lock this view" takes the preview's dragged
angle; the seat opens there and a drag no longer turns it — `VesselArtifact`
`viewPitch`/`viewToken`/`locked`/`onView`). "save to library"
keeps it in localStorage `nijimu.gallery.library`; nothing kept = `BUILT_IN`
(the 2026-10-11 settling: Y-01, Y-09, E-08, E-10, Y-03, Y-04, Y-17, Y-20,
Y-06, Y-07, Y-08, E-14, Y-16, E-02, Y-12, Y-13).
`libraryVessel`/`curatedStates` in `VesselGalleryPreview.tsx` build the
states; a gallery panel pushed after the library was saved still wins whole,
an older one keeps only its look. Thumbnails are 2D; only the focused shape
is a live canvas.

## Phone loading and performance (2026-10-11)

- Code splitting: every route except the landing layout is a router `lazy`
  route; the landing's 3D scenes (gallery, pond, descent) load through
  `components/landingScenes.ts` (preloaded when the landing is idle and on
  Enter); `BlobScene` lazy-loads `SceneViewer`; MediaPipe is imported only when
  hands are near (the descent's hold, or a camera starting). Main chunk 2.0 MB → 0.4 MB (606 → 134 KB gzip).
- GenRyuMin2 TW: `-ui` subset (~8 KB, the source's own CJK glyphs) is checked
  first; the 2.2 MB full font downloads only for other CJK text. Rebuild the
  subset when adding CJK characters (README, Fonts).
- Vessel builds: `lab/vesselBuilds.ts` caches glass + settled cloth by content
  and queues builds one per task, nearest seat first (`priority`, the gallery
  passes `ArtifactSeat.offset`). The canvas mounts only when its build is
  ready. Shared geometries are never disposed by callers.
- `lib/deviceTier.ts` (`?tier=light|full`, `?detail=`): phones get DPR ≤ 1.75,
  2× MSAA render targets and vessel glass at 0.8 of the superformula grid
  (raised from 0.6 / 1.5 on request for a little more resolution); the puddle sim stays at 2× for its
  grain. Photos: uploads are scaled to 1600 px (`lib/photoSize.ts`), seat
  textures to 1024 px, the gallery stills preload when idle.
- Hand tracking (`hooks/useHandTracking.ts`): the MediaPipe engine is the
  installed package's own (`?url` imports) and the model is
  `src/assets/mediapipe/hand_landmarker.task.gz` (unpacked with
  `DecompressionStream`; Google's copy only where that is missing), all
  served from `/assets/` with immutable caching (`vercel.json`). They download
  once per visit, together; the descent starts that at the hold
  (`preloadHandTracking`) and builds the tracker while the camera dialog is
  open (`prepare`), alongside the camera rather than after it. One tracker
  serves every handling step: a change of `numHands` is `setOptions`, never
  a rebuild or a new camera request. Detection runs once per new camera frame.
  Updating `@mediapipe/tasks-vision` keeps the engine in step; refresh the
  model file only if Google publishes a new one.
- Phone colour, ascent and naming (2026-10-11): the colour field's bowl mask
  (`OklchColorField`) is computed per pixel on phones, at the wash's own size
  (dip .07 of the width, 40 px soft edge), instead of the 1024×512 image
  stretched into a narrow screen. Safari ignores canvas `ctx.filter`, so the
  desktop mask uses the same per-pixel fallback where the filter is not
  honoured (within ~1/255 of Chrome's). The colour → naming float
  (`ascendSeconds`) is timed in screen heights: `ASCEND_S` × (landscape view
  ÷ the view the camera shows), so an upright phone's taller view takes
  ~3.75 s, not 6.5. On a phone, naming shows no transcript; the vessel sits
  under the fields and pressing it opens `MemoryReadingPane` with the words
  alone (name and year are optional there).
- Grain: the landing's is one grain per device pixel from a 512 px tile; the
  glass pane's tile is 256 px.
- Header menu (phones, ≤600px): the corner icons fold into a burger
  (`components/HeaderMenu.tsx`). Each control (App's profile/music, the
  gallery's plus/view toggle, the field toggle) renders a `HeaderMenuRow`
  portaled into the list when `useHeaderMenu().list` is set, else its own
  corner icon. The list's panel is the page itself: blur(24px) under a
  rgba(234,234,234,.6) paper tint (within a few levels of the landing, gallery
  and pond grounds) with the landing's per-device-pixel grain overlaid;
  rows are icon + name, 11×12 px padding, a soft shadow under the panel, ordered by `HEADER_MENU_ORDER`; the burger
  turns −90° as it opens. Wider screens keep the separate icons.
- Phone landing and gallery (2026-10-11): blobs at 0.62 scale, spawned 8–92%
  across, keeping 0.9 of their desktop blur so overlaps pool (`blobBlur`); dots
  5 px. On a phone the landing loads the scene chunks at once and
  `warmGalleryVessels` builds every memory's glass/cloth and decodes its photo
  in idle moments (`warmGalleryTransition`, landingScenes.ts). Gallery arrows
  read `--gallery-arrow-inset` (6 px on phones); the ruler sits 54 px up
  (`TS_BOTTOM_PX_PHONE`); their triangles scale by `--gallery-arrow-scale`
  (.5 on phones, .65 elsewhere) inside an unchanged button; they darken on
  hover for a mouse only (a tap used to leave them dark). The field
  toggle's menu row says "constellation view" / "timeline view".
- Phone gallery text (2026-10-11): ≤600px the gallery shows only name and
  year — no transcript under the year, no pointer trail (the trail is also off
  on any touch-first screen, and ignores every pointer that is not a mouse). Pressing the vessel
  at the apex opens `MemoryReadingPane` (GlassPane `tall`: fixed
  min(86dvh, 760px), scrolling inside; name in the caption's serif italic at
  BODY_SIZE, year in SERIF_CJK, the words left-aligned with no divider —
  three quarters of the old gap+rule+gap kept — an outline "close" at the foot). Wired in `LiveVesselGallery` via
  `onPick` on phones only; desktop's apex press is unchanged. The gallery's
  wheel/swipe/key handlers ignore events from an open `[role=dialog]`.
- Phone landing, lighter (2026-10-11): `lite` (≤768px) in BlobScene drops the
  gooey SVG filter and the `blobMorph` border-radius animation (both repaint
  per frame); blobs keep transform-only drift/breath at blur 0.6×. The ink
  entry on phones moves and shrinks each blob by transform alone (size, place
  and blur held as captured), so nothing is laid out or repainted per frame.
  The gallery tip is two rows (break before "to") at the wordmark's 12 px.
- Transcript trail spacing (`TranscriptTrail`): the gap before the next word
  is GAP_X_EM / STEP_Y_EM × a per-word draw in `JITTER` (.72–1.32) × a pace
  factor from the pointer's eased speed (SLOW_GAP .6 below 120 px/s, full
  above 900 px/s), floored so words never touch. Measured: slow ≈ 9–16 px of
  clear space between words, fast ≈ 15–24 px.
- Gallery scroll tip (`GalleryScrollHint`): while the pointer, a finger, or a
  word of the transcript trail (`[data-transcript-trail] [data-face]`) is within
  32 px of its words (`HINT_NEAR_PX`, a trigger zone that blocks nothing), it
  fades; it returns once that zone is clear (checked on pointer events and
  every 150 ms).
- Phone underwater steps (2026-10-11): everything keeps the header's side
  margin, `--chrome-inset` (18 px: the back arrow's and burger's glyphs from
  the edges; 14 px ≤359px; 20 px elsewhere, which FlowPageGrid's columns use).
  Heading lower and form higher (`UNDERWATER_PHONE.headingTop`/`artifactDrop`);
  the slider spans the margins above an 80 px foot row, a grid of
  [gesture illustration | camera capsule | round continue]. The illustration's
  cell is a square the size of the button, so the capsule is centred on the
  screen and keeps one width on every step; each illustration is scaled to
  fit that square (its drawn extent, `GESTURE_EXTENT` in GestureHint.tsx).
  With the camera off the capsule keeps its place: a pale fill and a
  struck-through camera; the gesture stays shown. Desktop keeps the corner
  camera, the pill continue and the gesture above the camera.
- Distance constellation on phones (`distancePreviewSeat`, vesselField.ts):
  the clear space round the handled form follows the screen's short side
  (desktop's height; an upright phone's width — the height pushed nearly every
  neighbour into two bands, several off screen). On portrait the push out of
  it is vertical with a per-place share (up to +45%), and a neighbour over the
  wrapped copy takes the nearest way out — sideways, above or below — that is
  on screen and clear of the form. Desktop placement is unchanged.
  `check-memory-distance.mjs` now asserts the clear space by the short side.
  An upright phone shows 8 neighbours seated in `PHONE_SLOTS`
  (DistanceConstellation.tsx): three between the copy and the form, one each
  side of it, three between it and the slider — larger ones in the roomier
  seats; each keeps its depth, so it still recedes with the slider. None steps
  above the copy, and any carried up past the copy's top fades. The distance
  palm hint drifts (4.6 s, scale .72–1.06) rather than pushing.
- SpectrumSlider ends are fixed 26 px boxes (`END_BOX`, min-width 0): the haze
  glyph is drawn 47 px wide and had widened its box, pushing the ruler off
  centre on the distance step. Phone copy: label 10 px, instructions 11 px.
- Glass panes (profile, dialogs): `IridescentSheen` draws premultiplied into
  a premultiplied canvas — the unpremultiplied canvas it used is composited
  differently by Safari and likely read as a bright white rim there (not
  seen in Chrome; Safari itself was not checked). On phones `GlassPane` uses
  blur(26px) and a denser tint, since the pane covers the gallery's vessels.

## Dialog action rows (2026-10-11)

All GlassPane action buttons use `PaneOptions` / `PaneOption`, including profile
and memory reading. Full-width rows have 1px top/bottom rules in
`GALLERY_TRANSCRIPT.color` (trail ink); adjacent rows share one rule, with zero
group gap and zero button margins. The last button has no bottom rule.
The trail rules use 25% opacity. The primary option's ink (`PANE_INK.primary`)
is the body copy's `CHROME_GRAY`, and the secondary options share that ink
and opacity; only weight sets them apart (primary 500, secondary 400).
A way out may wear an icon with `ring` (camera dialog's “Maybe later”: Phosphor's
clock, `ClockIcon`); on hover the icon fades and the grey ring opens from the
clock face's size. `PANE_ACTION.paddingY` supplies 18px vertical
button padding (14 until 2026-11-25) and reduces the pane's bottom inset by
the same amount. The hoped-for (primary) option's icon is
drawn solid — mic, camera (its lens a white ring round a solid eye; a cut-out let the pane's grey
through), with a check beside it in the camera dialog (`IconPair`, `CheckIcon`;
the mark's box grows leftward so the check keeps the icons' column), download (a
filled arrowhead) — through a `SolidIcon` context `PaneOption` provides; the
way out's icons stay in outline. Reading's
bottom anchoring belongs to the options wrapper (`atFoot`), never an inline
margin on the button. Instruction-dialog titles and body copy are left-aligned;
`PANE_CONTENT_GAP` sets title-to-copy spacing to 14px; copy-to-actions uses 1.5× (21px).
`PANE_BODY` is a pixel under `BODY_SIZE` (13–14px). On phones an open
`GlassPane` also blurs the whole screen behind it (`SCREEN_BLUR_PX`, a sibling
layer so the pane's own frost still reaches the page). "Keep a copy" offers
"Download as image" (download icon) and "Continue without download" (arrow).

## Phone layout (2026-10-10)

Underwater handling (shape/rhythm/distance/colour) uses `UNDERWATER_PHONE` in
`lib/theme.ts` at ≤600px: 13px instructions above the 12px English label,
14px title-to-copy gap, heading top clamped to 96–116px (14dvh), and an artifact
seat .075 of view height below the look point (desktop remains .01). The
shared `FlowPageGrid.headingTop` override scopes this to handling; photo and
naming retain their own rows. Constellation clearance follows the measured
heading bounds and its anchor follows the lowered artifact.

Breakpoint: `max-width: 600px` (`src/styles/responsive.css`, `useCompact()` in
`hooks/useCompact.ts`). Header icons and the back arrow read `--chrome-r0…r3`,
`--chrome-icon`, `--chrome-left` (desktop values are the old fixed seats; phones
pack them tighter, with safe-area insets); hover names are hidden on touch.
3D canvases that fill the screen mount `<PortraitFit />` (`lib/portraitView.ts`):
below aspect .8 the camera's zoom widens the view so a scene keeps its
landscape side-to-side framing; code sizing things from `fov` uses
`viewHalfTan(cam)`. `carouselFrame` grows to .42 of the width on upright
phones (`portraitTall`), and the near seats spread so they leave before
unmounting; landscape output is unchanged. Landing pans by pointer events,
transcript highlighting works by finger (sideways drag), the lab dock is hidden,
naming does not auto-focus on touch, pages use `h-dvh`, and `index.html` has
`viewport-fit=cover`. Not done: the revisit editors are camera-only.

## Underwater camera introduction (2026-10-10)

`HandTrackingDialog` appears when the dive and form ascent finish, before the
first handling step. `DescentRun` starts camera/hand tracking only after “allow
camera & begin”; it retains that choice across handling steps, offers retry on
startup failure and keeps the mouse fallback. Direct/reloaded underwater entry
also asks; `?camera=off` bypasses it for development. The dialog overlays the
existing water canvas without replacing it. `GlassPane` focuses its card on
opening and traps Tab navigation inside the dialog.

## Rhythm continuity (2026-10-10)

`DescentPrototype` retains its glass geometry and settled photo sheet while m2
changes. `getArtifactMesh(form, 128)` gives every rhythm target the same latitude
topology; its cache is separate from adaptive meshes. `artifactPose.ts` eases
displayed vertices toward the new posed form from their current positions,
including mid-transition retargeting. Normals and the photo sheet follow the
intermediate geometry each frame. Accepted pinch edits are capped at two m
units as well as the existing confirmation/deadband gates. Run
`node scripts/check-rhythm-transition.mjs` and the memory-shape checks for
topology, continuous retargeting, endpoint glitches and final-pose convergence.

## Pond → recording dialog continuity (2026-10-10)

Pond heading (2026-10-11): `PondHeading` (exported from `MemoryPondPage.tsx`)
fades in at its resting place (20vh above centre), never travelling, 300ms
after the camera has settled (`enabled`). The descent's floating phase — the
photo landed on the water — wears the same heading, "Begin building a vessel
for your memory."

The transcription pulse sits at screen y=.75 (.81 until 2026-11-25, a little further out now), with its floating label 96px
above the origin. `VoiceRippleSpot.soft` selects a gentle water-wave envelope
(encoded as negative strength in `uDrops`, with absolute strength for amplitude):
650ms entrance, eased initial expansion, and a smooth release before expiry.
Pulses arrive 1.25–1.7s apart with slight strength variation; stopping transcription
stops new pulses while existing waves decay. Other touch/voice ripples retain
their immediate response.

`LandingPage` now hosts `/memory/pond`, `/record/start`,
and `/record/descent` under the same route parent and retains one `DescentFlow`
through them. Opening or closing “Before you begin” only changes its chrome;
there is no canvas replacement or water-clock reset. `MemoryPondPage.renderScene`
lets its invitation/hold controls inhabit that scene. `PondWater` shares Stage's
wave uniform objects for halo, prompt ripples, pointer trails and touches;
Stage owns the camera and clock, and renders the single water surface.
The base camera uses `pondCamera.ts`, including gallery-to-pond arrival.
Prompt ripples stop spawning when the dialog opens but existing waves decay.
Naming keeps its separate, established above-water host and frame handoff.
Browser verification should compare `canvas[data-pond-scene]` across pond,
dialog, sample transcript, highlight and photo entry, as well as dialog close.

## Current flow layout and archived screens (2026-10-10)

`FlowPageGrid` owns heading and primary-action rows throughout the current
recording/highlight/photo/shape/rhythm/distance/feeling flow. `FLOW_PAGE` in
`src/app/lib/theme.ts` holds navigation height/top, heading top/width, and action
bottom tokens. Headings start at `clamp(132px, 22vh, 176px)`; continue actions sit
40px above the bottom (respecting safe-area insets). Naming fields use this same
heading row above the artifact, below the centered wordmark; they are not
portaled into navigation. Naming places the vessel in the scene row below the
fields and Save Memory in the bottom action row, with a reserved action height
so editing the fields never shifts the vessel. The photo heading is “imprint a photo with this memory”
and has no subtitle. Keep entrance transforms relative to the grid cell, with
no old absolute-centering translateX offsets.

The current create flow is `DescentFlow` (`/record/start`, `/record/transcript`,
`/record/descent`) followed by `PondNamingOverlay` (`/record/name`). The finished
transcript is reviewed before the photo; only its highlighting mode is archived. Older
standalone ShapeGrowPage, ShapeColorPage, ShapeTexturePage, and NameMemoryPage
live in `src/app/archive/shape-flow/`. Home no longer links to those shape steps;
`/record/shape/:step` redirects to the current descent with carried state.
The archived naming page remains only the older PuddleScene WebGL-failure
fallback. Labs and memory-revisit editors remain available.

## Distance and constellation (2026-10-10)

The handling flow is now shape → rhythm → distance → colour. Rhythm changes
only `ArtifactForm.side.m` (set 2, latitude), 0–16 in quarter steps; its slider
and full-screen drag are alternatives to a one-hand thumb–index aperture gesture.
`memoryRhythm.ts` maps the fingertip gap relative to wrist-to-middle-knuckle
length, with camera-aspect correction: closed is m2=0, a wide gap is m2=16.
Acquisition eases from the current value; losing tracking holds the value.
A 160ms smoothing filter, quarter steps, a small deadband, and a 5Hz edit limit
keep landmark tremor from rebuilding the mesh. Movement must agree for 200ms
before an edit (300ms to reverse); live and filtered readings must agree, so
brief spikes cannot trigger delayed changes. Confirmation follows direction,
allowing continuous finger motion to update without waiting for a fixed pose.
Tracking loss clears pending confirmation. `RHYTHM_PINCH` holds calibration.
The edited form travels through naming/save as the artifact's
form; the original assessment is retained. Entering Rhythm lifts growth to at
least .6 through the existing pose easing (`rhythmMorph`), so skipping Shape or
restoring an old zero-growth draft cannot hide every m2 edit behind a sphere.
Higher growth is retained; the revealed growth is carried into later steps and
saved. The neighbour preview uses the gallery's
existing irregular positions, with depth `2.4 + galleryDepth * 4.4` and added
haze reduced to 38% (saved haze remains intact). It does not generate rings or
reshuffle by angle. Only neighbours inside the central artifact's clearance
are shifted on one axis. Preview travel eases as `22 * haze³` so several
references remain visible through 70% and pass the eye by the endpoint.
Fixed neighbour world sizes compensate for the deeper starting seats and make
them 15% larger on screen at zero distance. The renderer uses the projected
seat size, so slider travel never changes mesh scale. `HANDLING_DROP = .01`
places the main artifact and its constellation 4% of screen height higher than
the previous .05 placement across underwater steps. The saved distance mapping
is unchanged.

At distance entry, `DescentRun` measures the foreground heading/copy with a
Range and ResizeObserver (including font load and viewport changes).
`distancePreviewSeat` reserves those bounds plus each neighbour's bounding
sphere and 24px spacing. Only overlapping starting seats move sideways;
these corrected world positions remain fixed throughout slider travel.

The pond invitation now uses a white luminous halo: a bright core and two soft
falloffs on a wider floating annulus, with the hold-progress arc retained.
`PerspectivePond` still shares its wave field with the halo. The settled pond
camera is lower (2.2 world units), looking farther ahead (z −32), while distant
water and reflected light extend into a slower haze for an open-ocean horizon.
These settings live in `pondCamera.ts` and the pond surface shader.

Recording → photo continuity: `/record/start`
and `/record/descent` share `LandingPage` with the pond
invitation; that layout keeps one `DescentFlow` mounted. Recording chrome renders over its live
pond; changing the route keeps the same Canvas, Stage, camera,
water clock and wave uniforms. The film's emergence clock starts only when the
photo step opens. Assessment reads the final transcript on that handoff (never
the in-progress transcription). The canvas's `data-pond-scene` identifies the
Three scene for continuity checks. Direct photo entry and the lab still work.
The recording overlay sends voice pulses to that Stage's wave field. Skipping
fades the instructions directly, without flashing the recording prompts.

Shape edits gently displace the existing water colour field around the form,
using a broad, uneven lens in the shared volume shader. Signed morph velocity
(mouse, keyboard or hands) drives the push, which relaxes when editing stops;
shape changes no longer generate circular light rings or surface ripples.
The underwater reveal raises the form 2.4 world units from below over 4.2–8.2
seconds. Opacity finishes at 5.2 seconds, the camera settles at 6.2, and shape
controls appear when the ascent finishes, leaving a visible climb against a
stationary view. The reveal itself does not scale the form.
During that climb, temporary arrival haze softens the photo, glass edge and
mist, while a localized Gaussian pass blurs its rendered silhouette. Both
follow the ascent progress and reach zero at its final seat; the user's
distance/frost value and saved gallery placement remain independent.
The Nicole naming rise retains its camera, glow timing and placement; its old
crystal renderer is replaced with this branch's photo-bearing `VesselArtifact`.
`namingDraft.ts` carries the exact form, morph, assignment, transcript, photo,
colour and vividness, and the memory ID survives into naming and saving.

The descent water stays pale: its underwater palette is lifted, and its wash
runs directly from 1.8–5.5 seconds, finishing before the form finishes rising.
The surface and full-frame volume share the same submerge interval; the surface
fades before the camera's near plane can cut a hard colour edge through it.

The descent's distance step shows the existing gallery vessels already inside
water, with no arrival motion (`DistanceConstellation.tsx`). They share the
shot's canvas and refraction target, and use `galleryStateFor` for their forms,
photos and pushed edits. The active memory stays at a constant apparent size
with a smoothly widened 72° lens and compensating camera dolly. The preview's
`distancePreviewSeat` distributes neighbours widely around a clear centre,
starting at least 3 depth units back (the active seat is 1.15); gallery layout
and saved distance values are unchanged. As frost increases the preview follows
the active memory's chosen depth, keeping it in place while moving neighbours
outward and past the camera. It remains in hand for
colour. A visible range input accompanies
the full-screen drag and hand gesture. The saved `look.vividness = 1 - frost`
also determines the memory's actual constellation seat. `vesselField.ts` owns
`memoryDepth` (1.15 + 22*haze²), `memoryFieldPlace` (preserves world x/y), and
`fieldVisibility` (fade at depths 8–20). Maximum blur is invisible even at the
gallery's maximum forward dolly; it remains accessible in the chronological
view. Memories without a distance choice retain their curated depth. Run
`node scripts/check-memory-distance.mjs` for the shared depth/projection checks.

## Transcript-to-form lab (2026-10-04)

Built-in sample reliability (2026-10-10): `src/app/data/sampleMemory.ts` owns
both the transcript and its saved GPT-4.1-mini assessment, with exact evidence
quotes validated in the regression script. Empty/direct photo entries use this
sample; sample text uses its stable seeded assignment without an API request.
Edited samples and recordings still use normal assessment/validation. An explicit
valid carried assignment wins; an old fallback does not override the sample.


`/lab/meaning` is the new assessment/parameter study. Record a memory or paste the
whole transcript, inspect four seeded family meshes, run “find its form”, and
“take it to the water” carries the transcript, memory ID and assignment into
`/lab/descent`. An unassessed transcript can also be carried there; assessment
runs while the photo is chosen. Descent waits for the reading to finish (or fail)
before holding can freeze the form; an API failure still permits a neutral fallback.
Going back to the transcript carries a finished assignment so continuing reuses it. Late replies never
replace a handled form. Naming saves the real transcript and assignment metadata.
The create flow continues into the same shot after the transcript: highlight,
then `/record/descent` (no lab knobs). `/lab/meaning` still carries a study into
`/lab/descent`. Direct descent entry still works with a neutral form and offers
a link to begin with a recorded memory.

- `shared/memory-assessment.mjs` is the runtime schema/validator, used by server
  and browser; `.d.mts` gives the frontend its types. Scores describe a memory,
  not a personality: orientation, comfort, intensity, discomfort, disruption,
  mixedness, evidence beats and insufficient evidence. Quotes must occur in the
  full transcript. Joyful intensity CAN create sharpness, per the user.
- `server/assess-memory.mjs` uses OpenAI Responses structured output (native fetch),
  reusing transcription’s `OPENAI_API_KEY`, optional `ASSESS_MODEL` (default
  `gpt-4.1-mini`), with `store: false`. POST `/api/assess-memory` has bounded input,
  a provider timeout and no retries. No key, invalid response, refusal or timeout
  falls back without inventing an interpretation. No transcript logging.
- `src/app/lib/memoryShape.ts` owns the derived patterns, mapping and versions.
  Four semantic families are separate from the twelve existing geometry labels;
  they use `ArtifactForm` spherical products plus optional radial/vertical
  `proportion` (included in mesh cache identity). Derivation and limits are
  documented there and in README. Seeded variation never selects the family.
- Near either category boundary the body softens; ties/insufficient evidence use
  a neutral sphere. Mixedness stays in the evidence and is not random noise.
  Slider/card choices are marked “manual study”, never presented as AI output.
- Run `node scripts/check-memory-shape.mjs` for contract, mapping, finite geometry,
  deterministic replay, stale transcript rejection, mocked provider, HTTP and
  cancellation checks; also run existing superformula checks/typecheck/build.
- Mocked API contract and real missing-key behavior were tested. A separate localhost
  synthetic provider also exercised the full browser flow through photo, descent,
  shaping, naming and gallery. `?camera=off` skips camera requests in the descent
  lab; shape/distance sliders accept arrows and Home/End. Live interpretation quality
  and the artistic family readings still require user judgement and calibration.

## Where work stands (2026-10-03, branch `10.3-Echo`)

Continue on **`10.3-Echo`**. It was cut from `10.3-mesh-Gielis-superformula` at
`dd87f31` (the merge of 9.19-Nicole into the superformula work). Leave
`10.3-mesh-Gielis-superformula` and `main` alone. Chat history does not follow a
new Cursor account; this section is the handoff.

The create flow after the transcript is this shot, at **`/record/descent`**
(`DescentFlow` in `src/app/lab/DescentPrototype.tsx`): the same canvas, without
the knobs, the timeline, or “again”. **`/lab/descent`** (`DescentPrototype`)
keeps those. Open either on the dev server. `?speed=0.3` slows the whole shot.
It is one canvas and one camera, using the pond's own wave field
(`POND_WAVES_GLSL` exported from `PerspectivePond.tsx`).

The shot, from the empty strip:

1. After recording, stay on the pond. An empty 35mm strip gathers itself out
   of the air in front of the view and hangs there (`CHOOSE_DEPTH`,
   `EMERGE_S`). Touching the strip opens the file picker (a local
   jpeg/png/webp/gif for this visit only); two bundled stills sit small at the
   bottom so the lab runs without one.
2. The photo develops into the strip's window, darks first (`uDevelop`,
   `DEVELOP_S`); a beat later (`LET_GO_S`) the strip is let go and falls —
   flutter, a soft landing, ripples — and floats. The earlier circle-thumbnail
   → strip morph is gone; `uMorph` is 1 from the start.
3. Hold to descend through the film into the water. The form surfaces.
4. Shape, distance, then color. While the form is handled, the water washes
   paler and less saturated so the object is what has the color.
5. On confirm, the film's emulsion lets go and the photo develops on the form
   as its photo map (the existing `MemoryPhotoLayer` look), darks first. The
   particle version of this step — the image falling as a point cloud — is
   kept in `wrapCloud.ts` behind `?cloud=1`, not in the shot (fourth pass,
   below).
6. The form rises, breaks the surface, and is named.

The film's surface (`filmFragment`) is now the film lab's strip, wired in on
2026-10-03: `STRIP_GLSL` + `FILM_LOOK_GLSL` + `SHEET_GLSL` from
`filmStrip.ts`/`filmLook.ts`, with the descent adding only what the shot needs
— the torn outline and worn edge, the develop (darks first, `uDevelop`), the
dissolve into grains (`uDissolve`), the sheen where the curl catches the sky,
and the backlit face from under the water (`uBelow`). The empty window is the
stock a shade lighter at .55 of its alpha; the photo develops into it through
`filmLook` and covers it at `uPhotoOpacity`. `filmUniforms` spreads
`filmLookUniforms()` and `sheetUniforms()` (the default stock, photo opacity
and edge fade), and `prepareFilmPhoto` is applied to the texture where
`request.texture` lands. `uMorph` is gone. Tune in `/lab/film`; what settles
there goes into `FILM_LOOK_DEFAULT`, `STOCKS`/`STOCK_DEFAULT` and
`SHEET_DEFAULT`, and the descent follows. Checked once on the water: the sheet
reads thin and pale there (distance, haze, 68% cover), which the user has not
yet judged. Portrait photos are cropped into the 36×24 frame; turning the
strip for a vertical photo was offered and not decided.

The photo's own film look is a second lab, **`/lab/film`**
(`src/app/lab/FilmPreview.tsx`): one flat strip facing the viewer, nothing
moving, drop or choose a photo, hold the strip to see it as uploaded, sliders
down the right. The look itself is `src/app/lib/filmLook.ts`: a GLSL function
`filmLook(sampler, uv)` plus its uniforms (`filmLookUniforms`, `setFilmLook`,
`prepareFilmPhoto` for the mipmaps it blurs with). The model follows
GrainLab's pipeline (MIT) rewritten for the GPU: tone (flatten, shoulder,
tinted lift) → saturation → midtone lean and shadow/highlight crossover →
bloom and halation from the photo's mipmaps → mottle → frame-relative grain →
vignette → a seed-placed leak. Defaults were first set against three
expired-stock scans the user gave, then against Yoshiyuki Okuyama's wider
work (lifted blue-grey blacks, warm cream highlights, saturation kept, broad
warm leaks from one side); the user has accepted the colour.
`FILM_LOOK_DEFAULT` is the place to write back what the sliders settle on
("copy values" puts them on the clipboard). The strip's own mm constants and
edge print moved to `src/app/lab/filmStrip.ts`, shared by both labs; the edge
print is thin (weight 300, hairline ticks) by request. The stock's colours are
a palette there too (`STOCKS`: grey-pink, grey, and grey-green, which the user
set in the preview and is the default, `STOCK_DEFAULT`; `setStock`), chosen
by swatches at the top of the preview's panel. "+" copies the chosen stock
into the user's own, with colour pickers for its four tints (cool end, base,
warm end, stain) and "remove"; "copy values" writes the palette out as a
`STOCKS` entry so a liked one can be added to the list. Own stocks live in
page state only. The sheet itself is `SHEET_GLSL` in `filmStrip.ts`, shared
by both labs: `sheetStock` (the stock's drift, stains and uneven thickness —
alpha .6–.88, lighter and more transparent where thin, a wash of light across
it), `sheetWindow` (the photo's frame fading into the stock over `uEdgeFade`
mm, unevenly, with a little bleed past the edge), `sheetDyeAlpha` (dark holds,
light lets what is behind through) and `sheetEdge` (the cut edge and the
perforations catch a hair of light, a faint shade inside). `sheetUniforms()`
carries the stock and `SHEET_DEFAULT` (`photoOpacity` .68 — the photo is a
layer of dye over the stock, not full cover, so the stock shows through the
picture and it changes with the strip; `edgeFade` 2.5 mm); both have sliders
in the preview. The preview alone adds a soft cast shadow mesh behind the
strip (`shadowFragment`).

A third lab, **`/lab/vessel`** (`src/app/lab/VesselPreview.tsx`), is a still
life of a different end state: the memory as one thin, almost clear glass
vessel (the superformula form, `?form=` seed, `?category=`, `?morph=`), with
the 35mm strip from `/lab/film` pressed loosely along its inner wall carrying
the photo — the photo is a thing inside the glass, not a map on its surface.
Nothing moves but a slow turn (`?turn=`, hold to stop, drag to turn; `?yaw=`
opens it turned, 180 is the far face); drop or choose a photo (`?photo=0|1`
or an image URL); sliders down the right in groups glass / refraction / sheet
/ dye / light / scene; "copy values" writes `VESSEL_TUNE_DEFAULT`, which is
where tuned values go back. Two glass looks switch at the top of the panel
(`?glass=frost|refract`, refract is the default): *frost* is the descent's
`formFragment` idea (toned shell, Fresnel rim, two or three frost patches, a
seed bubble); *refraction* has no tone of its own — the scene (backdrop
quad, ground, sheet) is drawn to a render target, blitted, and the glass's
facing and far walls (`glassRefractFragment`, on `FRONT_LAYER`) sample it
displaced along the view-space normal (`bend`), smeared by thickness
(`glassSoft`), darkened where thick (`thickDark`, the feet), with the live
`BubbleViewer` vocabulary for the edge — a dark rim line `pow(g, 3.3)`, a
thin film ring `pow(g, 20)` lit by the key, grazing reflection of a two-stop
room (`envAbove`/`envBelow`, `horizon`, `horizonSoft`). Back/front is decided
by `dot(n, v)`, not `gl_FrontFacing` — three flips the winding for a
`BackSide` material, and the far wall drawn as "facing" was what made the body
milky. `?show=glass|sheet` draws one layer alone. For the sheet the strip's
face was factored out of the descent's `filmFragment` into `STRIP_FACE_GLSL`
(`stripTornOutline`, `stripCoverage`, `stripFace`) in `filmStrip.ts`, and
`filmLook` took a third `bias` argument (mip bias, for the blurred far face);
the descent calls the same functions and renders as before. Not yet judged by
the user: the refraction look at all (it has only been seen in captures:
reads as thin clear glass, the strip legible through it, edges and feet
smeared; whether it wants more body is the `bodyAlpha`/`thickDark`/`bend`
question), the key highlight line, how the sheet sits for a portrait photo
(cropped into the 36×24 frame as in the film lab), and the frost look since
the back-wall fix. The second step the user named — the sheet wrap inside the
descent behind `?wrap=sheet` — was not started.

Small changes the same day: the seed bubble in the glass (a ring the user
read as a stray dot) is removed entirely — shader, knob, uniforms. The lab's
title and its line of instructions are gone; only the "lab — vessel" caption
stays. The refraction look's room takes colour: two colour pickers at the
head of the refraction group, above the horizon and below (`Room`,
`ROOM_DEFAULT` white/white, page state, reset with "reset", noted in "copy
values"); the lightness knobs multiply the colour (a pick sets its lightness
to 1 so what is picked is what is seen), and the horizon and its softness
remain the gradient. The glass's grazing reflection (`env()`) and the
backdrop quad read the same colours, so the glass reflects the room it sits
in. The caption's ink now follows the actual top colour's luma.

The turn is the eye's, since 2026-10-04: the camera orbits the form
(`yaw` from the slow turn and the horizontal drag, `pitch` and `distance`
from the "camera" knob group, the vertical drag writing `pitch`; `?pitch=`,
−35…85°, 4° is the still life) while the form, the key light and the room
stay in the world, so walking round it the lit side comes and goes and the
horizon's reflection slides over the glass — the lighting change the user
asked for comes from that, not from a moving light. The backdrop's horizon
follows the pitch (`backdropFor`). Under the table there is no table: the
ground tone and the mirrored reflection fade as the eye goes below it
(`tableFade`; `uReflect` −1 now marks the thing itself, 0 a reflection faded
out). The perforations are knobs too (the "sheet" group): `holeSize` (0
removes them), `holeWidth`, `holeFade` (1 leaves a faint mark where the cut
would be, not a hole) and the existing rim — in `filmStrip.ts` as
`uHoleShrink`/`uHoleFade`, 0 unless set so the descent and the film lab draw
true 35mm unchanged. The photo can be drained and inverted the same way:
`mono` and `negative` (0–1) at the foot of the "dye" group, applied in
`stripFace` after `filmLook` as `uMono`/`uNegative` (0 unless set), the
dye's density following what is left so a negative's clear sky holds dark.

The form can be changed in the panel too, to try the vessel on softer
bodies without a new mechanism: a "form" group at the top with the twelve
superformula categories as radios (choosing one draws a fresh deviation
inside it through `createArtifactForm`, as the shape step's debug picker
does; "another form" draws again in the same category; `?form=`/`?category=`
still set the opening form), the form described under them
(`describeForm`), and `morph` as a knob (0–1, the shape step's
morphProgress — how far the body has grown from its sphere; was the fixed
`?morph=`, default .6). The glass, its wall map and the sheet rebuild from
it. "copy values" writes the form's description above the values. The
softest bodies the mechanism makes are sphere (the BLOB variant, m 4, n
1.6–2.6) and rounded box (m 4, n 3–8); the user's question was whether the
sheet reads better in one of those than in the star-like default.

The vessel's sheet has two builds since 2026-10-04, switched by a
"pressed to the wall / draped" radio at the top of the sheet group
(`?sheet=pressed`; draped became the default once the user had tuned it —
the pressed build is unchanged). `VESSEL_TUNE_DEFAULT` and `ROOM_DEFAULT`
(#b3b3b3 above / #ffffff below) hold the user's settling of the refraction
look with the draped sheet: glass rim .38, thickness .3, frost size 1.25;
refraction bend .75, smear .64, thick-dark .21, highlight .34, lightness 1 /
.84; feel sheer .92, furred edge .2, sheen .31, gloss .43; dye lift .06,
soft .45, leak .72, photo opacity .83. The user's ask: the
fold should not run along the inner wall but hang like soft fabric, bending
when it wants to and leaving natural air between its face and the wall.
`buildDrapedSheet` is its own cloth — a 72×24 grid in true strip mm
(`STRIP_MM` × `sheetSize`) hung from one place on the wall (`anchorAngle`,
`anchorHeight`, `tilt`), pressed to the wall for `contact` mm, then peeling
toward the inside over `sag` mm by `peel` degrees, curling across (`curl`)
and twisting (`twist`), then settled as soft cloth against a radius map of
the inset glass (`buildWallMap`, θ/φ bins, blurred twice — the superformula
is star-shaped about its centre). The first settle snapped every vertex to
the wall and the user saw brittle plastic (jagged folds); it is now: 96×48
grid (≈1 mm a cell), 24 passes of loose distance constraints, the wall met
with a radial correction that is blurred across the sheet before it is
applied (a lobe bows the cloth over a width rather than printing a kink),
and a Taubin smooth each pass (Laplacian step, slightly larger step back, so
nothing shrinks) as the bending stiffness of gauze or soaked paper; `soft`
0…1 scales the smoothing, 0 is the crisp version; a last hard clamp keeps
everything inside the glass. The model is the user's own earlier draped-cloth
piece (a catenary plane computed once on the CPU, fine subdivision, smooth
normals, softness from the material): no solver, nothing moves. The feel is
a knob group of its own ("feel", draped only; the uniforms sit neutral when
pressed so the film look is untouched): `sheer` (alpha), `softRim` (a
Fresnel edge that lightens and thins so the outline furs), `sheen` (a broad
grazing light from the key), `gloss` (the film's hard highlight, 1 is film),
`grain` (screen-space, fine). The cloth carries its mm as an attribute
(`aMm`, `uMmAttr` 1), so `sheetFragment` draws the same strip; the pressed
sheet still derives mm from `vRest`. The user preferred the near face of the
sheet (sharp, lit, mip bias 0) to the far face (bias 1.6, dimmed by
`backFace`, cooler) and asked to be able to put that face against the glass:
"picture faces — the inside / the glass" under the sheet radios
(`?face=glass`, `SheetFace`, `uFlip`): the fragment's `facing` is
`gl_FrontFacing` xor the flip and `mm.x` is mirrored with it, so the strip is
truly turned over — the emulsion side reads the right way round from the
glass side and mirrored from inside. Works for both sheet builds. The knob
group "drape" shows only when
draped; `arc`/`band`/`lift`/`fold scale` only when pressed; "copy values"
notes which. Seen: at size 1.2 the strip hangs as one bowed sheet; at 1.5
(bigger than the cavity) it bows into the bowl in broad rounded folds. Not
yet judged by the user: the soft defaults (soft .7, sheer .8, softRim .35,
sheen .35, gloss .15, grain .04) and the light on its underside. The shape
defaults are the user's own settling (size 2.26, hung from 180° at height
1.0, tilt 2, contact 30.5 mm, sag 21 mm, peel 69°, curl .35, twist 15, gap
.03, soft .7) — a sheet much longer than the strip, pressed along most of
its length and peeling only at the end.

A fourth lab, **`/lab/gallery`** (`src/app/lab/VesselGalleryPreview.tsx`,
2026-10-04), is the live dive gallery with its crystals replaced by ten of
these vessels — the user's ask: ten different forms, each with one of ten
photos, the photo sized to its form, draped + refraction as the default,
negative off, the perforations reduced, and the gallery's text, layout and
interaction left exactly as they are. It is done by substitution, not a
copy: `GalleryOverrideContext` (`src/app/lib/galleryOverride.ts`) carries
`{ items, renderArtifact(item, seat) }`; `MemoryCarouselPage`, `PuddleScene`
and `PuddleDiveGallery` read it and, when it is `null` (every live route),
behave as before — `buildArchive()` for the items and `SceneViewer` in the
seat. The preview provides it and renders `MemoryCarouselPage` itself, so
the S-curve (`carouselSeat`), caption, timescale, arrows, wheel/keys,
overscroll to the pond and the exit are the gallery's own. The route is a
child of `RootLayout` so `GlobalControls` is there, and it can be reached
from the landing's top-left dock (`LabDock`, a "gallery" entry under
vessel) and from the live gallery, where a small "vessels" link sits beside
the back arrow in `PuddleDiveGallery` (a router `Link`, drawn only when no
override is present, so the preview itself does not show it) — the two
visible changes to live screens from this work. Its ten items are
`LIFE_EVENTS` 0, 2, 3, 5, 7, 8, 9, 11, 13, 15 with a fresh form in each of
sphere, rounded box, cylinder, prism, diamond, flower, star, gear, hybrid,
torn (`createArtifactForm({ seed: "vessel|<id>", category })`, `evolve`
.6; the star and the gear take a named `draw` — `vessel|star|5`,
`vessel|gear|2` — because those categories mostly come out as flat discs
with no side for a picture), and `look.photoUrl` from
`src/assets/vessel-gallery/01–10.jpg`
(`import.meta.glob`, sorted by name — drop differently named files there to
change the set; 1600 px long side, from the user's "nijimu photo test"
folder, 01–08 landscape, 09–10 portrait cropped into the frame). The tune is
`VESSEL_GALLERY_TUNE` = `VESSEL_TUNE_DEFAULT` with holeSize .6, holeWidth
.75, holeFade .75, holeRim .25, mono 0, negative 0, pitch 4, turn 0 and no
ground (no table, no reflection over the water); the sheet's `face` is
"glass"; the room is `VESSEL_GALLERY_ROOM` (#e6e7ea above / white below) —
the lab's grey wall, reflected by the glass and shown through it wherever
the frame behind is clear, read as a dark grey cast on every vessel over the
pale water (the user asked why everything was dark grey; the photos do go
through `filmLook`, and several of the ten are dark to begin with). The
override also asks for `wash: false` (no colour wash behind the apex) and
gives an `adjustSeat` that, from the first newer neighbour on, scales the
near seats down by up to 28% and moves them out toward the lower right
(`.09w`, `.1h`) so the outer foreground seat no longer covers the first and
second neighbours; both are read by `PuddleDiveGallery` only when an
override is present.

Pressing the vessel at the apex (a press and release without a drag,
`onPick`) opens the lab as an editor for that one memory: the preview
renders `VesselPreview` in place of the gallery with `initial` = the
memory's `VesselState` (tune incl. its fitted `sheetSize`, mode, sheetMode,
face, room, url, seed, form), `photos` = the ten gallery stills,
`yaw` = −anchorAngle, and "← back to the gallery" (`onBack`); `onChange`
hands the whole state back after each change, kept per memory in the
preview's page state with a version that keys the seat's geometry
(`VesselArtifact` `cacheKey` "id|version"; a new key for the same id
disposes the old build), and the memory's `sheetSize` prop then comes from
its tune rather than the fit. Returning renders `MemoryCarouselPage` with
`galleryFocusId` = that memory and `galleryCarried`, so the gallery opens
on it without diving. `VesselPreview` took those optional props for this
(`VesselPreviewProps`; without them the `/lab/vessel` page is unchanged),
and `Stage` a `yaw0`. One resolution fix: the seat canvases are measured
`offsetSize` (as `SceneViewer`'s `measureUnscaled` does) — the seats are
scaled by CSS transforms the resize observer never sees, so a canvas
mounted far down the curve was rendered at that tiny size and stretched at
the apex (the "2003 is blurry" report).

Each seat is a `VesselArtifact` (`src/app/lab/VesselArtifact.tsx`): its own
`<Canvas alpha>` with the lab's two-pass refraction, built once per
`cacheKey` and kept in a module map so a seat that leaves and comes back
does not rebuild its cloth. The sheet is sized to the cavity by
`fitSheetSize(glass)` so the picture covers the side it hangs on — the
user's ask, after a first cut at .86 of the height capped by the waist left
most pictures at half the form: the strip's width (its height, hung
upright) is the glass's full height, so the frame spans about .69 of the
side with the stock's bands above and below; only a form much taller than
it is round holds the strip back to ~.58 of the body's circumference
(1.15·π·bodyRadius, bodyRadius the mean radius of the waist) so the cloth
wraps the near half of the wall and not the back. The eye is set back so
the body fills the seat — by its height and 1.45× its mean radius, not its
farthest point, so a flat or spiky form is not shrunk by one spike. It
opens on the sheet's side of the wall (`yaw` = −`anchorAngle`), so with the
face on the glass the picture faces the viewer squarely and right-reading;
at the apex a drag on the canvas turns it round (.01 rad/px) and up or down
(`pitch`, .25°/px, `PITCH_MIN`…`PITCH_MAX`), pointer-captured, cursor grab —
the gallery already treats a press-and-release off an artifact as handling,
not leaving. `turn` is 0 in the gallery tune since a slow turn would carry
the picture away from the viewer. The `frameloop` is the one the gallery
gives the seat (`always` while focused or moving, `demand` when still). To share the
shaders the lab's uniform plumbing is exported from `VesselPreview.tsx`
(`createSheetUniformSet`/`writeSheetUniforms`, `createGlassUniformSet`/
`writeGlassUniforms`, `fitSheetSize`, the builders and fragments, `lookFor`,
`photoLoader`), and the lab's `Stage` now calls the same writers. One shader
change for the transparent canvas: the refraction's `behind()` samples
`vec4` and the body is `mix(env(0.0), frame.rgb/frame.a, frame.a)`, so where
the render target is clear the glass shows the room, not black — the lab is
unchanged since its backdrop has alpha 1. Not yet judged by the user: the
glass body over the gallery's pale ground (`bodyAlpha` .85), how the
full-height sheet folds in the lobed forms (flower, torn: it is wider than
their waist and bows into the bowl), the star and gear draws, and the first
frame after a resize, which can be dark until the render target has been
drawn once.

**Distance in the vessel (2026-10-04, evening).** The live distance step
("time blurs the edges, not the feeling") is a CSS `backdrop-filter` blur
over the whole canvas (`FrostOverlay`, `vividness` 1→0) and, in the descent,
a `uFrost` milk mix; the vessel had nothing. It now has a "distance" knob
group at the top of the panel (`?haze=` opens there): `haze` is the signal
the step would drive, 0 clear (the default everywhere, so nothing else
changed), and the rest say what a full haze does — `hazeBlur` (the finished
frame blurred, px; a post pass in the lab's `Stage` only: the frame goes to a
second target and reaches the screen through a separable 13-tap Gaussian,
`blurFragment`, `frame` → `pong` → screen), `hazePhoto` (mip levels added to
`filmLook`'s bias on both faces; `lookFor` also pushes the dye's `soft` to 1
with it and, with the wash, lowers contrast and saturation and lifts the
blacks), `hazeMist` / `hazeSpread` (the mist: six copies of the glass stood
off it along its normals, `mistVertex`/`mistFragment`, `MIST_SHELLS`, the
`Mist` component — a veil the air's colour, flat through each shell's middle
and thinning to nothing at its own edge, uneven as breath, drawn FrontSide
over the glass on its layer, so the silhouette is a gradient reaching past
the glass rather than a line), `hazeWash` (glass and sheet mix toward
`uAir`, the backdrop behind the form's upper half — `airOf`/`airFor` — and
thin), `hazeEdge` (the refraction's dark rim line, mirror and film ring, the
frost look's spec, the sheet's gloss and perforation rim go; the glass's
alpha stops gathering at the silhouette; the strip's cut feathers out over
up to 5× its wear; the perforations become a mark; the furred edge comes to
both sheets). The shaders take each part already multiplied by the haze
(`uHazePhoto`, `uHazeEdge`, `uHazeWash`, `uHazeMist`, `uHazeSpread`, `uAir`
in both uniform sets); `SheetWrite`/`GlassWrite` took an `air`. The gallery
seat (`VesselArtifact`) draws the same materials and the mist, so a memory
hazed in its editor comes back hazed; only the post blur is the lab's own.
Seen: at .5 the picture is soft and the outline fogged with the vessel still
itself; at 1 a pale grey form in the air; the shells alone, with no post
blur, already make the outline a gradient. Not yet judged by the user: the
defaults (blur 7, photo 2.6, mist .5, reach .16, wash .5, edge .85), whether
the mist should be denser toward the surface or more even, and whether a
hazed memory in the gallery wants the post blur too (a premultiplied blur on
the seat's transparent canvas; not built).

**The illumination (2026-10-04, night).** The user's reference: a long
exposure of fish under water — the body's edge luminous, the brights
bleeding past a soft outline — asked for as a faint pale glow in a layer or
ring outside the 3D, and then asked to move: flicker, breath, flow. Three
knobs in the distance group, each scaled by the haze. `hazeGlow`: a band of
light inside the silhouette of the glass (both looks, the facing wall) and of
every mist shell — `glowAt(facing, n, width)` in `GLASS_COMMON_GLSL`, a bump
in `facing` peaking at .3 (.45 on the outer shells), `glowColor()` whiter
than the air and a touch cool, lit toward the key. Two things learned
building it: facing goes as the square root of the screen distance to the
edge, so a band set near facing 0 is a one-pixel line and each shell drew a
ring (three rings at first) — peaking it well inside the edge, where the
shells overlap, sums them to one halo, and six shells (`MIST_SHELLS`, the
per-shell mist alpha halved to keep the fog the same) are enough for that;
and a shell swollen along smooth normals is not parallel to a creased form,
so its real silhouette fell where the smooth normal still faced the eye and
the band was cut there into a hard contour — `mistFragment` now takes its
facing near the edge from the surface as drawn (`dFdx`/`dFdy` of `vWorld`),
which does reach 0 at the silhouette; a sphere was clean either way, the
flower showed it. `hazeMove` (0 is still): inside `glowAt`, by `uTime` and
`uGlowMove` — a breath over eight seconds that swells the band outward as it
brightens (±.14, the peak ±.05), a flow (value noise over the model drifting
slowly, ±.35 — light wandering along the edge as caustics do), a shimmer
(finer, quicker, ±.15), and the mist's unevenness drifting with it; a pure
function of the clock. The lab's orbit loop writes the clock every frame; the
seat writes it in its own loop, so in the gallery the glow moves only while
the seat's frameloop runs (focused or moving) and a still seat holds its
frame. `hazeBloom` (lab only): a post pass after the blur —
`bloomExtractFragment` takes what is brighter than the known backdrop
gradient at each pixel (`excess`, so the frame itself never blooms) and
blurs it wide, `bloomCompositeFragment` screens it back over the soft frame
(`frame` → `pong` → `soft` → `pong` → screen; `BLUR_TAPS_GLSL` is the shared
13-tap kernel). The seat draws the glow and its movement but not the bloom.
Seen: at the defaults (glow .5, move .6, bloom .6) on the sphere a single
soft halo brightest at the edge, on the flower the same once the contour fix
was in; the first frames compared 2.5 s apart differ, so it breathes. Not yet
judged by the user: the defaults, the breath's eight seconds, whether the
shimmer is too quick for the room, and whether the gallery wants the bloom
(it would be the same two passes per seat canvas).

**The streaks (2026-10-04, later that night).** The user asked for the light
to be finer and richer: light seen running along the form's different edges,
not all edges at once — some places, at random, with a trail that fades
behind it. The glow has its own knob group now ("glow", after "distance":
`hazeGlow`, `glowBase`, `hazeMove`, `hazeBloom` moved there, and the
streaks). `glowAt` is `band · lit · uHazeGlow · (glowBase · halo + streaks)`:
`glowBase` is how much of the steady halo is there under the streaks (0
leaves only the runners), and `streaksAt(theta, phi, psi)` in
`GLASS_COMMON_GLSL` is up to eight runners (`streakN`), each with a life of
its own length (`streakLife` s, varied ±30%) lit for `streakDuty` of it and
rising and dying softly inside that, every life drawn fresh from the clock —
a new start, direction, speed and path — so nothing is stored and the seat's
demand frameloop can hold or resume it. The path is one of three, chosen per
life: round the silhouette as seen (theta, the angle on screen about the
form's centre from `viewMatrix`, so it is always on the edge), round the form
itself (phi, the model azimuth: it goes behind and comes back; chance
`streakRound`), or up or down the form (psi, the elevation, started from the
bottom or top) inside a window of azimuth, so one lobe's edge lights and not
the others (chance `streakUp`, tried first). Along the path each point is a
`comet(s)`: a short soft front ahead of the head (`streakHead` rad) and an
exponential tail behind it (`streakTail` rad) — the fade after it has
passed; `streakSpeed` rad/s; `streakFlicker` a slow noise along the trail;
`streakGain` its brightness over the halo (it can pass 1, the mixes are
clamped). Two fixes came with it: where a surface is seen nearly edge-on
(the flower's flat top from eye level) the band is a pixel wide and the six
shells drew as stacked rings when a streak passed — the band now lets go
where `fwidth` of the smooth facing says it is under a few pixels wide
(measured on the smooth normal: the mist's flat facing is constant per
triangle and its derivative cut the band along every triangle edge the first
time). Defaults: base .5, 3 streaks, gain 1.6, speed .35, tail 1.4, front
.18, life 9 s, duty .6, up .4, round .3, flicker .35. Seen in two CDP
captures 10 s apart: one edge lit and the rest dark, then the light moved on
and another runner began at the foot. The user was tuning the panel live
(tail to its maximum, lit-for 1) as this was written; nothing of theirs is
in the defaults yet. Not judged: the defaults, whether three paths are the
right three, the Cursor browser could not confirm motion by canvas
read-back (frames read identical while rAF ran at 52/s; `Page.captureScreenshot`
could).

**A kept default (2026-10-04, late).** Beside "copy values" the panel has
"make this the default": one press keeps the panel's settling — the tune and
the look's modes (`VesselDefaults`: tune, glass mode, sheet mode, face, room)
— in `localStorage` (`nijimu.vessel.defaults`), and `/lab/vessel` opens with
it from then on on that machine; "reset" returns to it; "back to the built-in
default" (shown only while one is kept) forgets it and returns to the code's.
`vesselDefaults()` in `VesselPreview.tsx` is the layering: the code's
`VESSEL_TUNE_DEFAULT` and mode constants under the kept values, with a
?param named on the URL (`morph`, `frost`, `pitch`, `turn`, `haze`, `glass`,
`sheet`, `face`) still winning over both. `VESSEL_TUNE_DEFAULT` itself is
unchanged and is still where a settling goes for everyone, by "copy values".
The gallery (`VESSEL_GALLERY_TUNE`) and an editor opened with `initial` do
not read the kept default. Checked: keep, reload (opened with it, the note
"opens with your default, kept on this machine" under the buttons), `?haze=`
over it, forget.

**The field (2026-10-04, evening) — a second view of the vessel gallery.**
The user asked for another view of `/lab/gallery` with the same ten vessels
as its matter, not ordered by time but hung in space with near and far —
stars in a galaxy, the far ones hazed — and a transition between the two
views that is light, smooth and cinematic, with arcs. It is built by
extension of `GalleryOverride`, so the live gallery is unchanged when no
override is present. `galleryOverride.ts`: `adjustSeat` takes the item and
returns a `SeatPlace` (a `SeatDepth` plus `haze`, `rotate`, `order`);
`ArtifactSeat` carries `haze`; `field` (`GalleryField`: `on`, `progress`,
`hovered`, `onHover`, `onPick`) and `chrome` (a node drawn with the
gallery's chrome) are new. `PuddleDiveGallery` reads them: with a field
present every memory stays mounted (a canvas made or lost at the switch was
a long frame — `loseContext` took 4 s in a profile — and the ones off the
curve are hidden by the preview instead); the transform takes `rotate` and
the z-order `order`; while `field.on` no seat is the apex, a press and
release on a seat is `field.onPick`, the pointer over one `field.onHover`,
and the caption shows the hovered memory's words (the last words stay in the
block while it fades); the wheel, touch and arrow keys do not step the rim
while in or between the views; the caption, ruler, arrows and plus stand down
when `field.on` or `progress` ≥ .35 and return in the last third of the way
back. `PuddleScene` and `MemoryCarouselPage` key their item memos on
`override.items`, not the override, since the preview re-provides every
frame. `src/app/lab/vesselField.ts` is the layout and the flight, pure:
`FIELD_PLACES` (ten hand-set places — screen fraction at the eye's rest and
depth; the near ones frame the view, the far ones gather toward the middle
and stay in frame when leaning in; the band under the centre where the
caption falls is left to small far things) taken in `FIELD_ORDER`;
`fieldSeat` (a pinhole projection, `FIELD_FOCAL` 1.15 deep is the apex's
size; haze from depth `(d − 1.4)/1.9`, so the vessel's own distance step
does the fogging — the mist, the softened photo, the loosened edges — with a
little CSS blur over it, fading with haze; what comes within .55 of the eye
softens and goes, its size capped so the hidden canvas stays small);
`surfacingSeat` (the same place `SURFACE_FROM` deeper, unseen — where a
memory with no seat on the curve begins); `easeFlight` (smoothstep eased out
again: lifts at once, long settle); `blendSeat` (a quadratic arc bowed
upward or outward by a fifth of the way plus a little, varied per seat; size
in log space with a 7% swell at the middle; a 4° sway with the direction of
travel; haze late in and early out as `share^1.4`). `VesselGalleryPreview`
keeps the clock: `FieldDriver` — each seat's share 0…1 with its own delay
(leaving, the outer rings first and the one in hand last, `STAGGER_MS` 55
per ring; coming home, the picked one first), `FLIGHT_MS` 1500, the whole's
progress, the camera (`DOLLY_IN` −.35 → 0 as the field forms, the eye
coming forward into it; parallax from the pointer `PARALLAX_X/Y`; the wheel
dollies `DOLLY_MIN` −.5 … `DOLLY_MAX` 1 at `DOLLY_PER_PX`), the hover lerp
(a hovered seat 5% nearer and 40% clearer). One rAF loop runs while anything
moves and bumps `frame`, which re-provides the override; the vessel's tune
with the seat's haze folded in is cached per hundredth (`tuneFor`) and the
seat is `memo(VesselArtifact)` with stable pick handlers, so a seat whose
distance has not changed is left alone; while the driver is busy every seat's
`frameloop` is `always`. `FieldToggle` (fixed, right 156, beside the plus)
switches; `?speed=0.2` slows the flight. Seen in the Cursor browser: the
curve lifts into the field and gathers back with no errors, the pick on a
far sphere made it the apex and the years re-formed round it, hover put its
words in the caption place, the dolly passed the near ones blurred and
fading; frame counts ~80–110/s with the main thread mostly idle (the 1000 ms
gaps in the counts are the webview's rAF throttle). Not yet judged by the
user: the places themselves (set for a landscape view; a portrait window
will crowd them), the arc's bow and sway, the stagger, whether the chrome
should return later, the haze curve by depth, and whether a picked memory
should also open (it only gathers the years round it). No reduced-motion
path for the flight.

**The arrival and the neighbours (2026-10-04, night).** The user saw the
vessels open fluorescent cyan-green and read it as the pictures or shaders
not yet loaded. It was the gallery's own arrival: `diveResolve` runs
`sepia(.5) hue-rotate(150deg)` and a 28px blur over the seat for
`artifactResolveMs` 1.8 s, and on grey glass the sepia turned by 150° is
that green. `GalleryOverride` took `arrival?: "water" | "plain"`; the
preview asks for `plain`, and `PuddleDiveGallery` then runs
`diveResolvePlain`/`diveDissolvePlain` (a rise and a fade, nothing done to
the colour, no blur) and skips the refraction wobble. Live routes have no
override and keep the water. Two more things so the seats open whole:
the photos are a module stock in `VesselArtifact.tsx` (`loadSeatPhoto`,
`peekSeatPhoto`, `preloadSeatPhotos`; one prepared texture per URL for the
visit, shared by the ten renderers, never disposed by a seat) and the
preview preloads its set as its module loads, so a seat that mounts finds
its picture already there; and each seat compiles its shaders off the frame
(`gl.compileAsync` for the scene and the blit pass) before it draws
anything — ten seats compiling on the same first frame was a long frame
with half-linked canvases. The "compiled" mark is a ref read by the frame
loop, not state: the frame an `invalidate()` asks for can run before React
commits, and with state the demand seats drew nothing (seen: only the apex,
which runs `always`). The newer neighbours: `adjustCurveSeat` shrinks the
+1 seat 22% and the +2 another 6%, moves them out by .045w each and down
.025h/.075h, and gives the apex the top `order` with a smooth bump
(`140·max(0, 1−|offset|/.8)`), so the selected vessel is no longer covered
by the one to its right and the +1 still keeps air from the +2. Seen: a
clear gap between apex and +1, the +2 partly off the right edge. Not yet
judged by the user: the plain arrival's feel against the water's, whether
the +1 wants to sit farther still, and whether the pictures should
preload on the live routes too (they do not; nothing live imports the
stock).

**The vessel in the descent (2026-10-05).** The user's direction: the whole
create flow will take the vessel look, starting with `/lab/descent`. The form
that surfaces after the hold is now the vessel of `/lab/vessel` — thin
refracting glass with the draped 35mm strip inside, the photo in the strip
(the bundled still or the one chosen at the film stage) — in place of the
old `formFragment` shell and the `MemoryPhotoLayer` overlay, which are gone
from the lab. Everything else in the shot (hold, descent path, the three
steps, confirm, rise, naming) is as it was. How it sits in the one canvas:
the vessel is a `<group ref={form}>` of glass back wall / sheet / glass
front wall (`glassVertex`/`glassRefractFragment`, `sheetVertex`/
`sheetFragment` imported from `VesselPreview.tsx`, `FRONT_LAYER` for the
glass) plus `Mist`; the post pass renders layer 0 (water, film, motes, the
sheet) to `refract.target`, blits it into `touch.target`, draws the glass
over it, then the touch quad to screen. Shared-module additions, all neutral
for the lab and the gallery: `uReveal` folded into `reflectFade`
(`REFLECT_GLSL`, 1 by default) so the vessel can come up out of the water;
`uDevelop` on the sheet (`stripFace`'s develop, 1.45 by default) so a photo
can develop into the strip; `buildWallMap` exported. The tune is
`VESSEL_TUNE` (the gallery's: draped, face to the glass, perforations
reduced, no table, `haze` written each frame); the room `VESSEL_ROOM`
(#e6e7ea / #ffffff) is lerped per frame from the water's tones toward the
paper tones with the wash and toward the sky as the form nears the surface,
with 40% of the colour step's tint, so the colour pick reaches the glass
through what it reflects. The distance step writes the vessel's `haze`
(mist, softened photo, loosened edges; no post blur in the descent). The
sheet is settled once on the sphere (`buildDrapedSheet`) and follows the
morph by radial ratio against the live wall map (`followWall`, normals
recomputed) — an approximation that holds for the BLOB sphere, not judged on
lobed forms. The body opens turned `OPEN_YAW` (π) so the picture faces the
eye and holds there through the steps, the wrap and the rise; it turns
slowly only once named. Resolution: the canvas is `dpr [1, 2]` (was 1.5) and
the refraction's `bend`/`glassSoft` are scaled by the vessel's size on
screen relative to the lab's (`LAB_ON_SCREEN`, a ~1 radius at distance 9,
fov 18) — unscaled, the picture inside was smeared several times over, the
user's first report. The photo is in the strip from the moment the form
surfaces (`PRINT_EARLY`, the default); `?print=wrap` keeps the earlier beat
of it developing into the strip over `overlayIn…overlayOut` at the wrap.

The end of the shot, same day: no dissolve, and no film overhead. The film
keeps its emulsion (`uDissolve` is no longer written after the emergence;
`releaseS` only drives the point cloud and its knob shows only with
`?cloud=1`) and is passed through on the way down: it thins away as a plain
fade (`uFade` on `filmFragment`) while the eye's depth goes 0.05 → 0.9
(`FILM_GONE_DEPTH`, latched in `filmGone` so it never returns), so under the
water there is nothing floating above the form — the user asked for the
overhead strip to go. The timeline has no film track; `filmBelow` left the
panel. The rise itself is a follow, not a path: the eye keeps
the offset it had to the form at the wrap and goes up with it, its look
sliding from the wrap's look point onto the form over the first .35, lifting
`riseAbove` (.6) as it nears the surface; between `riseViewUntil` (.5) and
`riseViewBack` (.92) camera and look lerp to `POND_CAMERA`/`POND_LOOK`, and
any wrap orbit (`orbitYaw`/`orbitPitch`) is let go over the same span.
`RISE_PATH`/`RISE_LOOK`, `riseYaw`/`risePitch` (the −18°/−49° turn from
below, which the user found dizzying) are gone; `RISE_FORM` is now a straight
rise under the film to `NAME_FORM_AT`. The camera crosses the surface
during the lerp, so the `crossing` blur reads once more on the way up.
Later the same night: `viewSink` (the wrap's slow sink of the view) is
removed — the wrap's view holds still after the draw-back. The rise is
slower (`RISE_S` 9) and springy: the form's progress along `RISE_FORM` and
the crossing to the pond view both go through `springProgress` (eased out
of rest, ~4% overshoot near .7, exactly 1 at the end), so the form comes up
a little past its seat and settles; defaults `riseViewUntil` .45,
`riseViewBack` 1. The bob is one slow drift throughout, quieting over the
last 40% of the rise (it used to change rhythm at the naming, a jolt).
Then the held beat went too: the rise begins as the draw-back ends
(`wrapEndsFor` → `WRAP_MOVE_S`; only with `?cloud=1` does `fallS` still
hold the view until the points have fallen), so confirm → draw back 2.2 s →
rise 9 s → named. With `?print=wrap` the develop now runs on the wrap's
clock into the rise rather than being forced done at the wrap's end. The
"timing" knob group is empty without the cloud and is not drawn. The
surfacing was then slowed (the user saw a hard cut: the form shot through
the surface at 1.4 u/s and the eye's spring to the pond view began on the
same beat): `springProgress` is gone; the form's way is `riseProgress(k,
surface, riseSurfaceAt, bob)` — under the water a cubic lifts it from rest
to ~.75 u/s and slows it to ~.5 at the surface (`RISE_TOUCH` .9 of its
slope), above it a power curve that takes up that slope and keeps slowing,
with a late bump of `riseBob` (.14 world units) past the seat and back; the
centre meets the surface at `riseSurfaceAt` (.55 of the rise, knob, also
the split of the rise track), the eye now eases (smoothstep, no spring) to
the pond view from `riseViewUntil` (.55). And the draw-back is subtler: the
form used to settle 1.7 under the look point (the old film-overhead
framing), now .45 — `lookY` −2.35 — about a quarter of the drop. Not
yet judged by the user: the follow's feel and the three new defaults, the
plain fade of the film, and the vessel's look under the water (body alpha
over the washed water, the frost patches at .15).

The shot is the live create route after the transcript (`/record/descent`).
`/lab/descent` is the same shot with its knobs. The earlier shape pages stay
reachable from the landing dock.

The underwater header keeps an explicit Back control: color → distance →
rhythm → shape → photo/hold-to-descend. It snapshots the current draft through
the same navigation as Continue, retaining edits and the mounted water scene,
including on direct step entry. Back during the color-to-naming glow cancels
the pending handoff. The lab follows the same sequence in local phase state.

Uploaded descent photos use FileReader data URLs rather than document-scoped
blob URLs, so the photo in the current router history draft survives refresh.
Before unload/pagehide, live underwater steps replace that entry's draft with
the current form, rhythm, distance, tint and photo (preserving router key/index).
This restores the active creation flow; it does not change gallery persistence.

The transcript screen replaces its history draft as soon as completed words
arrive and whenever highlights or reading progress change. Header Back carries
that draft through recording/the pond; the recording dialog offers “return to
your transcript” when a draft exists. Photo Back carries the whole draft back
to highlighting. A pending Continue fade is cancelled when the transcript
unmounts, so Back cannot be followed by a delayed jump to Photo. In-flight
transcription is still a network request; only completed words can be restored
after a refresh interrupts that request.

Done inside the lab since the first cut:

- The underwater steps use MediaPipe through `useHandTracking`: two palms
 apart → shape, thumb–index aperture → rhythm, an open palm pushing toward
 the camera → greater distance/blur, fingertip over the field → color
 (pinch to hold). Distance uses `memoryDistanceGesture.ts`: aspect-corrected
 wrist/knuckle size estimates proximity, calibrated on acquisition; pulling
 back reverses it. Finger spread does not set distance. Smoothing/deadband
 suppress jitter; a folded, edge-on, clipped or lost hand holds the value and
 reanchors on return. The animated distance hint shows an approaching palm.
 Synthetic push/pull, clamp, loss/reacquisition and camera-aspect checks live
 in `scripts/check-memory-distance.mjs`; live-camera feel needs user testing.
 The full-screen drag and the field's own pointer handling
 stay as the fallback when the camera is refused or no hand is seen; the hint
 under the copy says "drag across…" then, and "or drag across…" when the
 camera is live. A small greyed camera window sits bottom-right while a step
 is on. `GestureHint` shows under the copy when tracking.
- Naming saves. "save memory" calls `saveMemory` with the run's
 `ArtifactForm`, `evolve` = the shape step's morph (as `ShapeGrowPage`
 saves it), a material preset and `colorIndex` derived from the OKLCH hue
 the way `NamingRim` does, and a new optional `look` field
 (`MemoryLook` in `memoryStore.ts`: `photoUrl`, `oklch`, `vividness`).
 `ArchiveArtifact` carries `look` through `buildArchive`. The gallery and
 the viewers do not read `look` yet, so the archived blob still shows the
 palette tint and no photo; that render unification is the next foundation
 step. "see it among the others" then navigates to `/memory` with
 `{ galleryOpen, galleryFocusId, galleryCarried }`, the rim's own handoff.
 A device photo's `photoUrl` is an object URL and dies with the visit.
- The touch. During the three steps the frame is drawn through a post pass
 (`touchFragment`; a second `useFrame(…, 1)` in `Stage` renders the scene to
 a `WebGLRenderTarget`, then to the screen). Around each hand a soft lens
 bends what is behind it, a moving hand leaves a wake, the light splits by a
 hair. Hand positions come from `handCenter` of the MediaPipe landmarks
 (mirrored); while the camera sees no hand the pointer stands in
 (`StageState.hands`, `handsFrom`). Tuning lives in the shader constants
 (`.18` lens, `.1` split) and in the wake smoothing in the frame loop.
- The wrap: grains are about twice as large (`gl_PointSize` 8.5–16 px), a
 little softer and lighter each; the form grows 1.3× (`WRAP_GROW`, ≈2.2×
 volume) over `WRAP_MOVE_S` and keeps that size through the rise. The camera
 did not move. Details below.

### The wrap, in detail (the film → particles → photo map)

What the user asked for: on confirm the floating film overhead dissolves into
particles that sink and attach to the form's surface, arriving as the existing
`MemoryPhotoLayer` look. The sinking must be staggered and natural — grains
of different weight and size, weight slightly changing speed, uneven spacing,
never a dense sheet filling the water; light and flowing. Later: the grains
were too small (fixed, above), and the form should be 1–2× larger in volume
with the camera unchanged (fixed, `WRAP_GROW`).

Built (`buildParticles`, `particleVertex`/`particleFragment`, the wrap block
of `Stage`'s frame loop):

- Timing. Confirm on the color step sets `stage.wrap`; `wrapAt` is taken, the
 camera lerps to `WRAP_CAMERA`/`WRAP_LOOK` over `WRAP_MOVE_S` 2.2 s with the
 film overhead and the form in frame, the form turns to face front and grows.
 The particle clock starts half-way through that move. Grains release over
 `RELEASE_S` 2.2 s (top edge of the image first, a few early, then the
 rest); everything has sunk, been caught and faded by `WRAP_FALL_S` 7.2 s.
 Then the film is hidden, `onWrapped` fires and the rise begins. The view
 sinks 0.45 with the grains during the fall and that sink is carried into
 the start of the rise so there is no step.
- Grains. `PARTICLE_COUNT` 5200 is a ceiling; each grain is a vertex on the
 form's camera-facing hemisphere (`rest.sphere z > .05`, inside the photo
 disc), its photo pixel via `buildPhotoUv`, and the pixel's place on the
 film window (75% × 66% of the strip). A grid of occupied cells enforces a
 minimum spacing; vertices are visited in random order; darker image parts
 keep more grains (`.3 + .7(1-luma)²`), so the image stays faintly legible
 mid-fall. Colour is luma-based cool white (`f = .5 + .45·luma`), not the
 photo's hue. Weight `pow(rand, 2.2)` — skewed light.
- Motion (GPU). Terminal velocity `SINK_SPEED` 0.72–2.1 by weight (3×
 range); a slow buoyant bob the light grains feel most; a current carrying
 the column 60% toward the form's side; curl-noise drift, stronger for light
 grains. Nothing pulls a grain until it has sunk to within 1.3 of its end
 height, then it is caught and held (`catchK`), with `uForm` = the form's
 matrixWorld so the grains follow the growing, turning form.
- Hand-off to the map. Once held, a grain fades (light first, linger
 0.45–1.5 s) while `setMemoryPhotoFade` brings the overlay up over clock
 2.4–6.0 s; the overlay is `createMemoryPhotoMaterial` with
 `saturate .6, contrast 1.06, opacity .62` on a 1.012× copy of the form
 geometry. The film's emulsion goes with its grains (`uDissolve` over
 `RELEASE_S + 1.2`).
- Size is in world units: `gl_PointSize = uViewScale·size·(1 + byWeight·weight
 + .3·seed)/dist`, with `uViewScale` = viewport height in device px over
 2·tan(fov/2), so a grain is the same size in the water whatever the screen.
- The 700 ambient motes (`motesVertex`) are separate — dust in the water,
 not the photo; they fade with the wash.

Second pass (2026-10-03, later): everything about the wrap that is a matter
of judgement is a knob — `WrapTune` / `WRAP_TUNE_DEFAULT` at the top of the
file, a panel of sliders down the lab's right side (`WrapTunePanel`, "hide
knobs" folds it, "copy values" puts the object on the clipboard). `Stage`
reads the knobs every frame, so framing, grain size, colour, speeds and the
hand-off move while grains are already falling; count and release spread are
baked when the grains are built and take effect on "again". The knobs live
in `DescentPrototype`, so "again" keeps them. **`?from=wrap`** opens the lab on
the wrap itself (photo on the film, descent done, form surfaced and washed;
`?photo=0|1`, `?morph=`, `?frost=`), with "again" replaying from there —
`Stage`'s first frame sets the marks (`descentAt`, `fall`, `landedAt`, …) as
long past. Defaults in `WRAP_TUNE_DEFAULT` are the second pass's judgement:
camera (0,-3,7) looking at (0,-1.1,.2) so the film sits in the top band and
the form in the lower third; grains: the user's own settling, 3000 of size
.013, drift 2.14, caught from 1.0 (the rest of that group unchanged); darks
.58 / lights 1.0 so grains read as light, not sediment; the print rises at clock 3.6–7.0 and
the wrap ends at 8.0; `filmBelow` .6 — the film seen from under the water
used to keep only 42% of its image (`filmFragment`, back face) and was
invisible once the emulsion dissolved. Grains now carry the photo's pixel
(`aColor`) and luma (`aLuma`); `colorMix` 0→1 moves from cool white to the
photo's own hue at `colorSat`. `bindToOverlay` 1 keeps a caught grain until
the print has risen under it instead of fading after `linger`.

**Third pass (2026-10-03, night) — the point cloud.** The user showed four
TouchDesigner demos of theirs (dense sheets of tiny points folding like
smoke, bright where the sheet doubles over; one of them dark smoke on pale
grey) and asked for the particles to be refounded on that. What changed,
and supersedes the grain model described above (`buildParticles`,
`cloudVertex`/`cloudFragment`, the wrap block):

- The image is a sheet, not grains. `cloudCount` (default 90 000, ceiling
 `CLOUD_MAX` 200 000, on "again") points on a lightly jittered grid over the
 film window; each takes its pixel and — inverting `buildPhotoUv`'s planar
 projection — its place on the form's lit side, blended from the nearest
 form vertices binned by photo-uv. Points whose uv falls outside the photo
 disc (the image's corners) have no place (`aLands` 0) and thin away.
- The sheet stays whole. Release sweeps down the sheet (`aDelay` from the
 row, a slight lean); the landing sweeps the sheet too (`landAt`,
 `landOver`, each point gliding over `landEase`). `grain` 0→1 adds per-point
 lag to both, from a coherent sheet to loose points. No weights.
- Motion is a field. Curl of three value-noise potentials with analytic
 gradients (divergence-free, so the sheet folds without bunching), two
 octaves (`fieldScale`, `fieldAmp`, `fieldDetail`), drifting slowly with
 time (`evolve`), plus a sink and a pull toward the form's column
 (`current`). Each point's path is the field integrated from its own release
 in ten fixed half-second steps in the vertex shader — a pure function of the
 cloud clock, so the timeline can still scrub it. The swirl eases with a
 point's own age: full until `calmAfter` (1.4 s), down to a quarter over
 `calmOver` (1.8 s) — the user liked the first movement (around 3 s on the
 shot clock) and found what followed too wide, spreading to the sides; after
 the ease the way on is mostly the sink (.7) and the pull toward the form's
 column (`current` .6), with `fieldAmp` down to .7. The timeline shows this
 on a "swirl" track, from the first release.
- Points carry the photo's tones by default (`blend` 2, normal blending): a
 black pixel is a point of value `grainDark` .2, a white one `grainBright`
 .9, grey or the photo's own colour by `colorMix`. The first cut was ink
 (`blend` 1: `CustomBlending` dst·(1−src), slate `uInkColor`) and read as
 black on the water — the user asked for the photo's tones instead. `blend`
 0 is additive light, the TouchDesigner-on-black reading. The material's
 `blending` is switched per frame. Size is in pixels (`pointPx` 1.5, mild
 distance attenuation), a square below ~2 px and a soft disc above.
- Nothing attaches. The user asked that points not settle as a solid skin
 on the form (the first cut formed a visible ball) but melt like snow before
 the ground: on its glide a point shrinks (to 20%) and fades, gone by `melt`
 .8 of the way. `linger`/`bindToOverlay` are gone with that.
- The print develops rather than fading in flat. `developOnForm` patches the
 shared `MemoryPhotoLayer` material (`onBeforeCompile`, at its alpha line):
 reveal is a threshold on `luma·developDarks + (1−uv.y)·developSweep` that
 `uDevelop` (0…1 over `overlayIn`…`overlayOut`, cloud clock) moves past,
 each part coming up over `developSoft` — darks first, the top of the image
 (where the sheet lands first) leading, as on paper in the tray. The user
 asked for exactly this feel from the image's first appearance on the form.
- Timeline tracks are now camera, film, cloud ("the sheet flows", its end
 dragging `landAt`), swirl, lands (`landAt` … `+landOver+landEase`), print,
 rise.
- The form sits under the film. The film rests at z 2 and the form used to
 glide to z −0.2 for the wrap, so the sheet fell 2.2 units in front of it
 and read as landing on its near side; the user asked for straight down.
 `formZ` (default 2.0, = `FILM_AT.z`) is a knob; the camera default moved
 back to z 8.6 looking at z 2.0. `orbitYaw`/`orbitPitch` (degrees) turn the
 view about its look point once the wrap has begun — to watch the fall from
 another side without changing the shot. The rise has its own turn
 (`riseYaw` −18, `risePitch` −49: from below, looking up at the form
 against the light — the user's pick), taken up over the first 22% of the
 rise, held until `riseViewUntil` .45 and let go by `riseViewBack` .85 as
 the form comes up to the pond view; the camera track shows both spans.
- The hourglass (`mode` 1; 0 is the sheet in the field, the default). The
 user's image: the film becomes sand. The sheet funnels to a neck
 (`neckDrop` .9 below the film, `neckRadius` .12) over `gatherS` 1.6 s,
 then pours over `pourS` 3 s — down from the neck, lateral spread
 `pow(s, spread)` (2.0: narrow long, opening late) toward each point's place
 on the form's **upper** surface (`aTop`: the sheet laid over the top
 hemisphere, image top at the far side, nearest-vertex blend binned by x/z),
 with a `twist` that unwinds as it lands. The melt applies on the last 40%
 of the pour. The field, landing sweep and swirl knobs do nothing in this
 mode; the timeline shows gather/pour tracks instead of cloud/swirl/lands.

Seen once, at 4.2 s: the sheet reads as a folded grey veil over the water,
lighter and darker with the image, convincingly like the references; the
form below still plain (development begins at 3.2 on the cloud clock). The
melt and the development were not seen — the Cursor browser tab stops
painting within seconds of opening now. Judge: whether 90k points at
`pointAlpha` .12 is the right weight; whether the long straight glide from
the sheet's height to the form reads as melting or as flying in (if the
latter, raise `landAt` so the field has sunk the sheet nearer first, or
lower `melt`); whether the development's darks-first/top-first mix is
right. The field's magnitude (`uAmp * .35` inside `field`) and the
integration (`STEPS` 10 × `STEP` .5) are the two constants not on the
panel.

The timeline (`Timeline`, along the bottom once the wrap has begun): the
shot runs from confirm, left to right, with the camera, film, cloud,
lands, print and rise as tracks and each phase an outlined block whose span
is computed from the knobs (`phaseBlocks`) — so the blocks move as the
sliders do, and the other way: dragging a block's edge writes the knob
behind it (`setFrom`/`setTo`, clamped to the slider's range), dragging a
block with both edges editable shifts both (the print), and a fixed edge
(the camera's 2.2 s, the rise's 6 s) has no handle. Pressing a block seeks
to its start and underlines its knob group in the panel; pressing the empty
track seeks there; while paused a dragged edge carries the playhead with it.
Above the tracks: ‹‹ ‹ play/pause › ›› step by a second and a tenth, the
clock, the phases under the playhead, speed, and "fold". Seeking works
because the wrap and the rise are functions of `t − wrapAt`: `Transport`
(`paused`, `speed`, `seek`) is a ref the frame loop reads first; a seek sets
`time.current` and re-latches `wrapped`/`riseAt`/`risen`/`broke`, the film's
visibility and the page phase (`onRewound`).

Seen in a browser this time (Cursor's own browser: it stops painting when its
webview is hidden while `document.hidden` stays false, and its screenshot
tool then returns a stale frame — reopen the tab beside the chat and check a
clock; the CDP `Page.captureScreenshot` is current). Before the pass the film
hung at the very top edge and left the frame as the view sank, the grains were
1–3 px, and the print was already on the form while most grains were in the
air. Not yet judged by the user: the new defaults, colour on vs off, bind on
vs off.

**Fourth pass (2026-10-04) — the cloud set aside.** The user decided the
core experience does not have particles for now; the work is to be kept on
this branch, switchable, but not the default. So: everything about the point
cloud (both motions, the hourglass, melt, the knobs, the timeline tracks, the
shaders, `readPhoto`, the geometry build) moved whole into
**`src/app/lab/wrapCloud.ts`** — `CloudTune`/`CLOUD_TUNE_DEFAULT`,
`CLOUD_KNOBS`, `CLOUD_TRACKS`/`cloudPhaseBlocks`, `createCloudUniforms`,
`createCloudMaterial`, `setCloudUniforms`, `buildCloudGeometry`. The lab's
`WrapTune extends CloudTune`, so the defaults, "copy values" and "reset"
still carry the cloud's values, but the lab only builds the geometry,
drives the uniforms, draws the `<points>`, shows the cloud's knob groups and
timeline tracks when **`?cloud=1`** is on the URL (`CLOUD` in
`DescentPrototype.tsx`; a "with / without the point cloud" button at the foot
of the knobs panel reloads with it toggled). Nothing in the live create flow
imports `wrapCloud.ts`.

The core wrap, without the cloud, is now: the view draws back and the form
grows (`WRAP_MOVE_S`), the film's emulsion lets go from the top down over
`releaseS` (`uDissolve`) leaving a clear base, the print develops on the form
over `overlayIn`…`overlayOut` (darks first, the top of the image leading —
`developOnForm`/`setDevelop`, the knob group "print"), the wrap ends at
`fallS`, and the form rises with its own view (`riseYaw`/`risePitch`). The
panel shows framing / timing / print only. Checked in a browser in both modes
after the move; the shot ran through to naming without errors.

Not built / not judged:

- Whether the gap the cloud leaves — the image lifting off the film and
 nothing crossing the water to the form — wants something quieter in its
 place (a wash, the print's own light), or is right as a cut.
- Grains come only from the lit hemisphere; the back of the form gets its
 map from the overlay alone.
- No interaction between the grains and the hands (the touch pass bends them
 like everything else, but they do not part around a hand).
- No reduced-motion path for the wrap.

Gaps still inside the shot, in the order they matter:

- Recording and the transcript highlight stay on the live pond. Continuing
  from the highlight opens `/record/descent` on the empty strip.
- No reduced-motion path. The timeline steps and scrubs the wrap and the
 rise only; nothing before the confirm can be stepped back through
 (`?from=wrap` jumps to the wrap, but only from a fresh load).
- Left unjudged: the form reads thin under frost on the color step, the wrap
  framing, and the sky after the rise, which is very bright.

Color picking (`src/app/lib/oklch.ts`, `FIELD`) was pulled toward the landing
palette: lower chroma, less candy green and yellow, darker toward slate. This
changes the live color step as well as the lab. The photo tray
(`PhotoLibraryTray`) can add a device photo; the data URL lives in module
memory for this visit and is gone on reload.

GenRyuMin2 TW Regular is self-hosted
(`src/assets/fonts/GenRyuMin2TW-Regular.woff2`, SIL OFL). The CDN import is gone.

Discussed and not built: a more watercolor landing-ink transition. Revisit
already exists at `/memory/revisit`; it is the existing editor path, not a new
immersive viewer.

Shape work starts in `ShapeGrowPage.tsx`, `BubbleViewer.tsx`, `SceneViewer.tsx`,
and `src/app/lib/superformula.ts`. `formDraft.ts` keeps some editor settings in
sessionStorage; recorded memories also use tab-scoped sessionStorage and survive refresh. Historical plans under
`docs/superpowers/` describe earlier states. Follow current source and this
guide when they conflict. `.env.local` is gitignored and stays on this machine.

---

## 1. What nijimu is

nijimu (滲む — Japanese for "to blur / bleed into") is a **poetic memory-keeping
web app**. The user speaks a memory aloud, it's transcribed and optionally
rewritten into literary prose by AI, then sculpted into a soft 3D "object" that
joins a field of blurred blobs on the home canvas — each blob is one memory.

It is a mood piece, not a utility app. The aesthetic is quiet, contemplative,
low-contrast, serif-heavy. Copy is lowercase and unhurried. **When editing UI,
match that restraint** — no bright accents, no exclamation marks, no dense
chrome.

The app began as a **Figma Make export** (see `README.md`) and has since been
refactored into a real codebase.

---

## 2. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Build tool | **Vite 6** | Transpiles via esbuild; does *not* typecheck |
| UI | **React 19** + TypeScript | |
| Routing | **react-router 7** | `createBrowserRouter`, one layout route |
| 3D | **three** + **@react-three/fiber** + **@react-three/drei** | The memory "objects" |
| Hand gestures | **@mediapipe/tasks-vision** | Pinch/hand-distance controls in shape editors |
| Voice→text | **OpenAI speech-to-text** via `/api/transcribe` | Audio recorded with `MediaRecorder`, transcribed server-side; key never reaches the browser |
| AI polish | **@anthropic-ai/sdk** (Claude) | Server-side only; key never reaches the browser |
| Styling | Mostly **inline `style={}`** objects; Tailwind 4 is present but lightly used | |
| Package manager | **pnpm** (pinned in `packageManager`) | `npm install` fails on React 19 peer deps — always use pnpm |
| Deploy target | **Vercel** → nijimu.space | GitHub Pages is abandoned (can't run the API) |

Dependencies are deliberately minimal (9 runtime deps). A large pile of unused
Figma-export deps (MUI, Radix, etc.) was pruned — **don't reintroduce a UI
library**; build with the existing primitives.

---

## 3. Commands

```bash
pnpm install       # use pnpm, never npm
pnpm dev           # Vite dev server on :5180 (includes polish + transcribe endpoints)
pnpm build         # vite build + copy-404.mjs (the 404 copy is a harmless GH-Pages leftover)
pnpm typecheck     # tsc --noEmit on src + vite.config.ts — run before pushing
```

There is **no test framework**. Verification is: `pnpm typecheck`, `pnpm build`,
and manually exercising the running dev server. Standalone Node assertions also
exist in `scripts/check-*.mjs` for carousel, pond, transcription routing, and voice
behavior; these are not wired into a package test script.

---

## 4. Directory map — where to find things

```
nijimu/
├── src/
│   ├── main.tsx                    # entry — mounts <App/>
│   ├── app/
│   │   ├── App.tsx                 # ROUTER + GlobalControls (music/profile)
│   │   ├── components/             # one file per live screen, plus shared UI
│   │   ├── lab/                    # /lab/descent — in-progress create shot; /lab/film — the photo's film look, flat; /lab/vessel — the memory as a glass vessel, still; /lab/gallery — the dive gallery seated with ten vessels, with a second view (the field, vesselField.ts) they fly to and from; wrapCloud.ts — the point cloud, kept aside (?cloud=1)
│   │   ├── archive/                # unused former record-loop pages
│   │   ├── hooks/                  # reusable behavior (see §7)
│   │   ├── lib/                    # pure/shared modules (see §6)
│   │   └── data/memoryData.ts      # the 15 curated demo memories + color indices
│   ├── styles/                     # global CSS, fonts, tokens
│   ├── assets/fonts/               # self-hosted Exposure Trial .otf files
│   └── imports/                    # Figma-export raw SVG/asset files (9 kept, still referenced)
├── server/
│   ├── polish.mjs                  # THE AI polish handler (pure JS function; single source of truth)
│   ├── transcribe.mjs              # THE speech-to-text handler (same shape as polish.mjs)
│   ├── vite-plugin-polish.mjs      # mounts POST /api/polish on the Vite DEV server
│   └── vite-plugin-transcribe.mjs  # mounts POST /api/transcribe on the Vite DEV server
├── api/
│   ├── polish.mjs                  # Vercel serverless function — wraps server/polish.mjs for PROD
│   └── transcribe.mjs              # Vercel serverless function — wraps server/transcribe.mjs
├── docs/superpowers/               # design specs + deploy/refactor plans (context, not code)
├── scripts/copy-404.mjs            # GH-Pages SPA fallback (leftover, harmless on Vercel)
├── vercel.json                     # SPA rewrites (everything except /api → index.html)
├── vite.config.ts                  # Vite config + registers the dev polish plugin
├── tsconfig.json                   # FRONTEND typescript config (browser-oriented)
└── package.json
```

---

## 5. Application flow (the two journeys)

Everything is a route in `src/app/App.tsx`, wrapped in a single `RootLayout`
that renders `GlobalControls` (background music + profile button) once; the
music itself is a single player in `lib/soundtrack.ts`, so **navigating, and
even reloading, carries it on**.

**A. Create a memory** (the main flow):
```
/  (landing)
 └ /memory            MemoryCarouselPage — dive gallery
   └ /memory/pond     MemoryPondPage — hold to record
     └ /record/start      PondRecordingOverlay on MemoryPondPage — records and transcribes
       └ /record/descent     the descent shot — photo, film, shape, distance, color, rise, name
         └ /memory           same gallery, now including the new memory
```

**B. Revisit memories:**
```
/memory/scroll   MemoryScrollPage — vertical dot list with a 3D preview
 └ /memory/revisit  RevisitMemoryPage
   └ /memory/edit/weight | /color | /texture   EditXPage editors
     └ /record/saved  MemorySavedPage — writes the edited memory
```

Landing, carousel, pond, recording, transcript, and naming share a mounted
`LandingPage` layout; its route children render no separate page themselves.
The descent shot is the create path after the transcript. The earlier
build/grow/color/texture pages remain sibling routes, opened from the landing dock.
Other former screens (blob recording, gray transcript, orb / click / process,
and older sculpt variants) remain in `src/app/archive/record-loop/`.

The profile is **not a route** — the profile button in `GlobalControls` opens
`ProfilePanel`, a glass popup over the current page (iridescent WebGL sheen from
`IridescentSheen` + grain), so opening it never leaves the page you were on.

### State passing (important gotcha)
The create flow carries data forward via **react-router `location.state`**
(`navigate(path, { state })`), accumulated step by step. This means **deep-linking
into the middle of the flow loses context** and pages fall back to sample data.
A `location.state` → context/store refactor is noted as future work but not done.

---

## 6. `src/app/lib/` — shared modules

| File | Purpose |
|---|---|
| `theme.ts` | Font-stack constants (`SERIF`, `SANS`, `SANS_UI`, `SERIF_DISPLAY`, …). **Use these instead of inline font strings.** |
| `colors.ts` | `COLOR_PALETTE` (the 9 blob tints w/ light variants) + `MEMORY_COLORS`. Single source — was duplicated in 4 files. |
| `memoryStore.ts` | Session-only user memories. `loadMemories()`, `saveMemory()`, `toMemoryEvent()`. Tab-scoped sessionStorage restores the full memory, including its photo, on reload. |
| `polish.ts` | Browser-side `requestPolish(transcript)` — POSTs to `/api/polish`, never throws (returns `{polished, error}`). |
| `transcribe.ts` | Browser-side `requestTranscription(audio)` — POSTs the recording to `/api/transcribe`, never throws. Also holds the **recording→transcript hand-off**: `beginTranscription(audio)` starts the request and returns an id, `getTranscription(id)` picks it up on the next screen. |

Shared components (in `components/`): **`PillButton`** (the rounded button used
everywhere — variants `light`/`dark`/`outline`) and **`PageHeader`** (the
lowercase "nijimu" wordmark link). Prefer these over hand-rolling.

---

## 7. `src/app/hooks/`

| Hook | Purpose |
|---|---|
| `useVoiceRecorder.ts` | The recording session: `MediaRecorder` capture (3 min cap, 64 kbps), microphone errors, and a loudness meter. Hands the finished `Blob` to `onStop`; exposes `level` + `voicePulse` so the puddle can ripple with the voice. |
| `useHandTracking.ts` | Owns the MediaPipe camera + HandLandmarker **lifecycle** (init, stream, detect loop, teardown, GPU→CPU fallback). Hands raw landmarks back via `onLandmarks`; **each page does its own gesture math** using the exported helpers `landmarkDistance`, `handCenter`, `createGestureGate`. |
| `useOscillatingEvolve.ts` | Shared 10s "breathing" animation cycle for the 3D shapes during the build steps. |

---

## 8. The AI features (how the pieces connect)

### 8a. Transcription — the spoken memory becomes words

```
Browser: PondRecordingOverlay (mounted by MemoryPondPage)
   └ hooks/useVoiceRecorder  MediaRecorder ──► audio Blob
   └ lib/transcribe.ts  beginTranscription() ──POST /api/transcribe (raw audio body)──┐
                                                                                      │
   DEV:  server/vite-plugin-transcribe.mjs  ──────────────────────────────────────────┤─→ server/transcribe.mjs
   PROD: api/transcribe.mjs (Vercel function) ────────────────────────────────────────┘     transcribeAudio()
                                                                                                  └─→ OpenAI speech-to-text
```

- The request **outlives the recording screen**: `beginTranscription()` fires it,
  returns an id, and the screen navigates on with that id in `location.state`.
  `TranscriptPage` looks the request up and shows "transcribing…" until the words
  land, then types them in. The audio itself never enters `location.state`.
- The body is the **raw recording**, with its mime type in `Content-Type` — no
  multipart parsing in the endpoint. Format follows the browser (webm/opus in
  Chrome, mp4 in Safari); `server/transcribe.mjs` maps it to a filename OpenAI
  will accept.
- Key: `OPENAI_API_KEY` (server-side only). Model default `gpt-4o-transcribe`,
  overridable via `TRANSCRIBE_MODEL`.
- Guardrails: recordings cap at 3 minutes at 64 kbps (~1.5 MB), bodies at 4 MB (Vercel's limit is 4.5 MB).
- Unlike polish, transcription **is** a gate — there is no memory without words,
  so a failure shows the reason and a "record again" way back.

### 8b. Polish — the words become prose

**Current UI status:** the backend and browser helper remain implemented, but
`requestPolish()` is only called by the archived gray `TranscriptPage`. The
highlight screen is archived too; the live transcript review prints the full
transcription before the photo and does not highlight words.
The following describes the retained polish implementation, not an active step
in the current create journey.

```
Browser: TranscriptPage
   └ lib/polish.ts  requestPolish()  ──POST /api/polish──┐
                                                         │
   DEV:  server/vite-plugin-polish.mjs  ────────────────┤─→ server/polish.mjs
   PROD: api/polish.mjs (Vercel function) ──────────────┘     polishTranscript()
                                                                    └─→ Anthropic API (Claude)
```

- **`server/polish.mjs`** holds the real logic (`polishTranscript()`) and the
  system prompt. It is the single source of truth, imported by both the dev
  plugin and the Vercel function. It is **plain JavaScript on purpose** (see §9).
- The **API key lives only server-side** (`ANTHROPIC_API_KEY` env var, no `VITE_`
  prefix). It is never in the client bundle.
- Model default: `claude-opus-4-8`, overridable via `POLISH_MODEL`.
- Guardrails: transcript must be ≥3 words and ≤5000 chars.
- Polish is **never a gate** — if it fails, the original transcript flows on.

Local setup: copy `.env.local.example` → `.env.local` and set `OPENAI_API_KEY`
(recording) and `ANTHROPIC_API_KEY` (polish). Both also have to exist as Vercel
environment variables for production.

---

## 9. Non-obvious rules & gotchas (read before editing)

1. **The `api/` + `server/` function path is plain JavaScript (`.mjs`), not
   TypeScript — on purpose.** `api/*.mjs` + `server/*.mjs` are JS so Vercel's
   `@vercel/node` bundles them with esbuild and never runs a TypeScript compile
   step (that step repeatedly crashed the Vercel build with "Cannot read
   properties of undefined (reading 'readFile')" on this toolchain). **Keep this
   path JS.** If you must add types, use JSDoc — don't convert these files back
   to `.ts`. The frontend (`src/`) stays TypeScript; `tsconfig.json` covers only
   that. Also don't add `allowImportingTsExtensions` to the root tsconfig or
   import files with a `.ts`/`.tsx` extension.

2. **pnpm only.** `npm install` fails on React 19 peer deps.

3. **Guest-session persistence.** User-made memories use tab-scoped sessionStorage
   (`lib/memoryStore.ts`) and survive refreshes during this visit. Store the complete
   artifact and photo; do not claim success when browser storage fails. There is no
   permanent or public archive. The 15 curated memories in `data/memoryData.ts`
   remain available alongside the guest’s saved memories.

4. **The soundtrack is one player outside React** (`lib/soundtrack.ts`):
   `GlobalControls` only reads and toggles it (`useSoundtrack`,
   `setSoundtrackMuted`), so no route change — including the labs and `/style`
   outside the layout — stops or restarts it. Music on/off and its position are
   kept in sessionStorage (`nijimu.soundtrack`, saved on `pagehide`), so a reload
   carries on; where the browser refuses sound before a gesture it plays
   silently and takes up its sound at the first press. Don't create another
   `Audio` for it per page. `GlobalControls` stays in the layout route.

5. **`src/imports/`** is Figma-export residue. Only 9 files there are still
   referenced (some SVG path modules + `NewMomoryIdle`/`PlusSign`). Don't build
   new features on top of it.

6. **Deploy = push.** Vercel auto-deploys `main`. `vercel.json` handles SPA
   routing. No GitHub Actions workflow (the old GH-Pages one was removed).

7. **Styling is mostly inline `style={}`.** That's the existing convention here;
   follow it for consistency rather than introducing CSS modules or a UI kit.

---

## 10. Further context

`docs/superpowers/` holds the design spec for the voice/polish feature and the
refactor + deployment plans. They explain *why* decisions were made and what's
intentionally deferred (e.g. merging the 6 ShapeX/EditX editor pages, moving
flow state off `location.state`, code-splitting the ~1.5 MB bundle). Consult
them before large structural changes so you don't redo settled decisions.


**Surface continuity (2026-10-10).** Both the legacy feeling entry and the current
`DescentRun` color step now ease their color fields/chrome out over 1.4 seconds
while the existing silhouette brightens into light. Descent uses local shader
wrappers and a soft post glow; gallery materials are unchanged. `surfaceHandoff.ts`
keeps one transient canvas frame across navigation until `VesselArtifact.onReady`
reports a complete frame (including the photo). The naming wash is behind the
artifact, and its rise clock waits for that renderer. Back, including the naming
fallbacks, calls `resumeColorState` and returns to `/record/descent` with
`resumeStep: "color"`; the stage opens at its handled underwater pose and preserves
form/m2, morph, photo, color, distance, transcript and original assessment. It does
not reopen the older `/record/shape/feeling` route or reassess the handled memory.


**Partial feeling tint (2026-10-10; gradient 2026-10-30; continuous 2026-10-31).**
`vesselTint.ts` stains the glass with the saved OKLCH pick itself
(`memoryTintLight/Chroma/Hue`) — every point of the colour field
(`sampleHomePalette`, the landing's palette) is its own shade; it no longer
snaps to the ten `LANDING_TONES`. The descent's frame loop reads the pick each
frame, and the field writes it on every pointer move, so the glass follows a
drag across the field as it moves. The shared
glass shader (`feelingTint`) holds a deeper band of that tone (l −.1, chroma
×1.25; `MEMORY_FOOT` .75) over the lowest 3% of the height, blends it into the
tone itself by 16%, and fades the tone linearly to clear by half the height
(`MEMORY_STAIN` .6). The tone is a filter over what the glass shows (a pale
ground reads as the tone), and `tintAssert` lifts the glass's alpha so it shows
through the thin face. Heights come from each glass's own lo/hi
(`GlassWrite.span` → `uTintSpan`; the descent re-measures its morphing glass
in `followWall`). One strength serves the colour step, naming and the gallery.
Descent reduces the uniform room cast from .4 to .06; naming/gallery use their
neutral room plus this same stain. Standalone vessel
studies default to zero stain. Rhythm now uses the thumb–index
aperture interaction described above, superseding the earlier gesture proposals.

**Highlighted phrases (2026-10-10, archived 2026-10-11).** The drag-to-highlight
screen lives in `archive/highlight-transcript/`. The gallery trail no longer
inks those phrases. The trail still lets the transcript's words fall in order
wherever the pointer is, one each time it has moved clear of the last (`GAP_X_EM`,
`STEP_Y_EM`), each showing `DELAY_MS` after it is set down. The last `TRAIL`
stay; the oldest comes apart into grains on the trail's canvas (`grainsOf`
reads the word back from a 2D canvas; `SWEEP_S`, `GRAIN_SPEED`, `GRAIN_LIFE`),
drifting away from the line.
