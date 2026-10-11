# nijimu

This is a code bundle for nijimu. 

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Pages

- `/`: landing — enter opens the 3D memory carousel
- `/memory`: 3D memory carousel
- `/memory/pond`: hold to record a memory
- `/ripple`: home canvas where memories sit as a watercolor puddle, blob field, or ripple field
- `/record/start`: speak a memory aloud — the recording step of the create flow
- `/record/transcript`: shows the spoken words and word highlights
- `/record/descent`: choose a photo, let the film settle, then hold to descend
- `/record/descent/shape`: shape the memory underwater
- `/record/descent/rhythm`: adjust the form's folds and rhythm
- `/record/descent/distance`: choose the memory's distance in the constellation
- `/record/descent/color`: choose its colour / feeling
- `/record/name`: give the memory a title and year
- `/record/saved`: confirmation after editing a saved memory
- `/memory/scroll`: vertical list of memories with a live 3D preview
- `/memory/revisit`: open a saved memory and its 3D object
- `/memory/edit/weight`: re-sculpt an existing memory's weight
- `/memory/edit/color`: re-tint an existing memory
- `/memory/edit/texture`: re-texture an existing memory
---

`/style` — design system of buttons and labels (unlinked from the rest of the app)

The profile has no page of its own: the profile button opens a glass popup over
whatever page you are on.

The colour page keeps its continuous, curved water field, now blending the
homescreen palette from rose and sand through mist, sky, sage, ocean, slate,
purple and night. The hues are strengthened for visibility in the water, with a
richer purple derived from the homescreen’s grey-violet slate. The field uses
85% opacity and retains colour as it lightens toward the top;
pointer and hand input sample the same gradient. The earlier full-spectrum
version was duplicated into
[`src/app/archive/color-spectrum-2026-10-10/`](src/app/archive/color-spectrum-2026-10-10/README.md)
before this change, including the shared scene, colour field and palette helpers.
It is a source snapshot, not an active page route.

Both the timeline and constellation have a **create** button in the header.
From the constellation, memories rise at different speeds according to their
depth to reveal the pond; returning reverses that motion. Reduced motion uses
the pond fade without moving the constellation.

The create flow gives each underwater step its own browser-history entry.
Back from distance returns to rhythm, then shape, then the photo/film step;
Forward retraces those entries. Revisiting the photo/film step reopens the empty
template so a photo can be chosen again, including after returning to the transcript.
Forward into an existing underwater entry restores that entry's photo. These
routes keep the same canvas, water clock and current edits mounted. Returning from naming restores the handled
memory at colour. Direct underwater URLs open that step using a carried draft,
or the sample form when no draft is available. `/lab/descent` keeps its separate
animation controls; `/record/shape/:step` remains an older-bookmark redirect.

On naming, **save memory** opens a guest notice: memories remain in the
gallery for the current browser-tab session, including after a refresh. The complete
memory (photo, transcript and edited appearance) is kept in `sessionStorage`, not
a permanent or public archive. **continue without download** opens the
gallery; **download memory** first saves a PNG with the nijimu wordmark, the
chosen artifact and photo, its name/year, and the full transcript beneath it.
The image uses the gallery water shader without neighbouring artifacts. Export
layout grows for long transcripts. Download errors leave the dialog open to retry.
Run `node scripts/check-memory-image.mjs` for text-wrapping regression checks and
`node scripts/check-memory-store.mjs` for session restoration and storage-failure checks.


## Fonts

Stacks live in `src/app/lib/theme.ts`. Faces are loaded in `src/styles/fonts.css`.

| Font | How it's loaded | Used as |
|---|---|---|
| **Rowan** | Self-hosted woff2 (Light–Bold, roman + italic) | Latin serif — English titles, body (`SERIF`) |
| **GenRyuMin2 TW** | Self-hosted woff2 subset (Regular; SIL OFL) | East Asian serif — the 滲む wordmark (`SERIF_CJK`); CJK fallback on `SERIF` |
| **Exposure Trial** | Self-hosted `ExposureTrial-20.otf` (optical grade −20) | Recording / profile display (`SERIF_EXPOSURE`) |
| **Exposure Trial Plus** | Self-hosted `ExposureTrial+10.otf` (optical grade +10) | Transcript / polish display (`SERIF_DISPLAY`) |
| **Switzer** | Self-hosted woff2 (Thin–Black, roman + italic) | UI sans — labels, light / outline buttons, editor chrome (`SANS`) |

Named but not loaded: **SF Pro** (`SANS_UI` — Apple system font on dark buttons, then `system-ui`).

System / leftover fallbacks: **Georgia** (serif fallback; also hardcoded in a few pages), **Helvetica Neue / Helvetica / Arial** (`RecordingProcessPage`), and **SF Mono / Monaco / monospace** (timer on `/record/click` and shape-editor numeric readouts).

```
SERIF          = Rowan, 'GenRyuMin2 TW', Georgia, serif
SERIF_CJK      = 'GenRyuMin2 TW', Rowan, Georgia, serif
SERIF_DISPLAY  = 'Exposure Trial Plus', Rowan, 'GenRyuMin2 TW', Georgia, serif
SERIF_EXPOSURE = 'Exposure Trial', Rowan, 'GenRyuMin2 TW', Georgia, serif
SANS           = Switzer, sans-serif
SANS_UI        = 'SF Pro', system-ui, sans-serif
```

## Homescreen shortcuts (`/ripple`)

| Key | Action |
|---|---|
| **A** | Original blob field (compare) |
| **B** | Puddle field |
| **Z** | Ripple2d field (default on this route) |
| **G** | Open memory artifact gallery (on the puddle homescreen: the dive-through-the-water gallery) |
| **V** | Toggle gallery variant: dive ↔ morph (A/B; dive is the default and only runs on the puddle homescreen) |
| **← / →** | Browse gallery |
| **Esc** | Exit gallery |


## Memory-to-form study (`/lab/meaning`)

This lab connects a full recorded or typed transcript to the photo/descent lab.
The create route does the same after highlighting a transcript, at
`/record/descent`, without the lab knobs. Start the app with `pnpm dev`, open
`http://localhost:5180/lab/meaning`, record/paste a memory, then **find its form**.
The four mesh cards and score sliders also work without an API key, explicitly
labelled as manual studies. **Take it to the water** carries the assignment into
`/lab/descent`; choosing a photo, sculpting and naming retain it. If you continue
before requesting a reading, it runs while choosing the photo. API failure never
blocks descent; the fallback is an unassigned sphere, not fabricated sentiment.

Assessment reuses the transcription `OPENAI_API_KEY` server-side in `.env.local`
(or Vercel); no separate key is needed. The optional `ASSESS_MODEL` defaults to
`gpt-4.1-mini`. Restart Vite after changing
environment values. Only the transcript is sent for assessment, not the photo.
The API uses [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
with response storage disabled, then validates ranges, bounded text and exact evidence quotes independently.

### How the forms are derived

The map is hand-drawn: eighteen kept vessel shapes (Y-01…Y-20, see
`docs/lab/y-shapes.md`) placed on the two axes, `MAP_ANCHORS` in
`src/app/lib/memoryShape.ts`. Measured on their meshes, outward follows the
profile (more profile lobes, side `m` 13–20 against 0–8 inward; rims wider than
the waist; lopsided `n2≠n3` cross-sections) and sharpness follows the
protrusions (how far the form reaches past its mean radius; more cross-section
lobes). Both trends are refitted by least squares from the anchors at load
(`MAP_TRENDS`).

A point takes the form of its nearest anchor (the seed may pick among anchors
within .06 of the nearest), then leans the rest of the way: the profile's `m`
moves by the outward slope (at most ±3), and the radius is raised to a power
`k` (`n1 → n1/k`, `k` in .6…1.5) so the reach matches the sharpness slope.
The seed then varies the anchor within `VARIATION`: exponents by about
×0.84…1.2 (n2 = n3 kept equal), an uneven a/b by ±8%, the profile's `m` by up
to 1.2 lobes; the cross-section's `m` is left alone so closed seams stay closed.
Kept shapes with fractional `m` keep their open seams.

The assessment returns inward/outward orientation independently of positivity.
Sharpness is `clamp(max(intensity, .7*discomfort + .3*disruption) - .15*comfort)`;
joyful intensity can therefore be sharp. The coefficients are artistic starting
values, not psychological measures. Bilinear quadrant weights name the family
(none at a tie, though the map still gives the form); only a missing or
insufficient reading uses a neutral sphere. The weights are not confidence probabilities.
Mixed feelings remain visible in the evidence; they do not add arbitrary spikes.

Each assignment records its model/rubric/mapping version, seed, source, transcript
revision fingerprint, scores, family and exact form. The fingerprint detects
stale handoffs, not malicious tampering. Memories remain session-only. Model
responses may vary; stored assignments and their seeded geometry do not reroll.

Verification: `node scripts/check-memory-shape.mjs`,
`node scripts/check-superformula.mjs`, `pnpm typecheck`, and `pnpm build`.
For keyboard-only lab runs use `/lab/meaning?camera=off` (or
`/lab/descent?camera=off`). Shape and distance accept arrow keys, Home and End.
The full synthetic browser journey was also checked through naming and gallery.
The new tests use synthetic transcripts and a mocked provider; assess real model
quality against human-labelled full memories separately.
