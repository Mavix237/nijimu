# nijimu — Project Guide for AI Assistants

> This file orients an AI coding assistant (Cursor, Claude, etc.) to the nijimu
> codebase: what it is, how it's built, where things live, and the non-obvious
> rules. Read it before making changes.

## Fixed landing field (2026-10-30)

The landing (`BlobScene` with `classicChrome`) uses a viewport-sized field and
caption layers. Dragging, touch gestures and wheel input do not pan it; its
blobs and captions retain their ambient animation. Legacy blend previews keep
their existing larger field and movement controls.
Landing caption boxes are measured against the viewport with a 20px inset;
long titles wrap, and their text and dots shift inward as the washes drift.

The landing's washes (`WatercolorField`, tuned live by the "tune" panel,
`WashTunePanel`/`lib/washTune.ts`, kept in localStorage `nijimu.landing.wash`)
wear the colour step's tones: `WASH_TONES` in `BlobScene` samples
`lib/homePaletteField.ts` per `MEMORY_COLORS` slot (cloud is mist's pale top;
the second slate is the field's purple at .8 chroma). A cursor stroke thins
the paint under it (`wipe`, "paper drawn in", 1.3× the brush) so clear paper
is carried into the washes; tide lines are drawn only near a wash's resting
rim, never where stirred paint thins inside one. Paint stirred while the
washes open follows them with a 0.3 s lag (`GROW_RELAX_S`) instead of snapping
back when the stirring stops. Wash centres keep `BLOB_MIN_GAP` (12% of the
field) apart, so fewer pool into one field.

## Gallery artifact width cap (2026-10-30)

Gallery transcripts no longer follow the cursor. On wider screens,
`PuddleDiveGallery` reveals the centered full transcript after the selected
artifact has rested at the apex for `TRANSCRIPT_DWELL_MS` (3 seconds).
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

The capped gallery's centre is enlarged 3%, easing out before adjacent seats.
The first right seat is now about 4% larger than the centre; the second is
reduced a further 5% (`adjustCurveSeat` in
`VesselGalleryPreview.tsx`). The two right seats move
inward by 3% and 5% of screen width; smooth offset weights preserve scrolling
and the phone's additional clearance. The view toggle imports the root
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
(`CaptionTranscript`), the first line comes in word by word (`WORD_STAGGER_MS`
70), each word sliding down out of its own mask; the rest follow line by line
(`LINE_STAGGER_MS` 80), starting one step after the first line's last word.

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
clock face's size. `PANE_ACTION.paddingY` supplies 14px vertical
button padding and reduces the pane's bottom inset by the same 14px. Reading's
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

The transcription pulse sits at screen y=.81, with its floating label 96px
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
│   │   └── data/memoryData.ts      # the 16 curated demo memories + color indices
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
| `useVoiceRecorder.ts` | The recording session: `MediaRecorder` capture (60s cap), microphone errors, and a loudness meter. Hands the finished `Blob` to `onStop`; exposes `level` + `voicePulse` so the puddle can ripple with the voice. |
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
- Guardrails: recordings cap at 60s, bodies at 4 MB (Vercel's limit is 4.5 MB).
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
   permanent or public archive. The 16 curated memories in `data/memoryData.ts`
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


**Partial feeling tint (2026-10-10; gradient 2026-10-30).** `vesselTint.ts` maps
the saved OKLCH pick into a faint glass stain (`MEMORY_STAIN` .36, chroma × .65).
The shared glass shader (`feelingTint`) lays it as a linear gradient up the
vessel: full at the glass's lowest point, clear by half its height, measured
from each glass's own lo/hi (`GlassWrite.span` → `uTintSpan`; the descent
re-measures its morphing glass in `followWall`). It uses transmission colour
without adding alpha or whitening the photo. One strength serves the colour
step, naming and the gallery — naming's former rim-only override
(`NAMING_STAIN`, `memoryTintSpread`) is gone, so the colour step shows the tint
the vessel arrives with. Descent reduces the uniform room cast from .4 to .06;
naming/gallery use their neutral room plus this same stain. Standalone vessel
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
