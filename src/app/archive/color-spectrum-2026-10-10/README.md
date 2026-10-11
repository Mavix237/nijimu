# Full-spectrum colour page snapshot

Saved before the homescreen-palette field experiment on 2026-10-10.
This is a source snapshot, not an active route. Files retain their original
contents and paths relative to `src/app/`:

- `lab/DescentPrototype.tsx`: the complete shared scene, including the colour
  page, its hue slider, gestures and handoff into naming.
- `components/OklchColorField.tsx`: the curved, full-spectrum water wash.
- `lib/oklch.ts`: the hue/lightness mapping and colour conversions.
- `lib/paletteWater.ts`: the wash's flowing-water treatment.
- `lib/colors.ts`: the palette at the time of capture.

The snapshot deliberately preserves the original imports. To compare or restore,
use these files at their corresponding `src/app/` paths in an isolated checkout;
do not mount the archived scene directly from this directory. Other shared
renderers remain in the main source tree.

The active experiment retains `components/OklchColorField.tsx`, with its colours
sampled from `lib/homePaletteField.ts`. The shared `lib/oklch.ts` remains unchanged so curated
memories and older editors keep their original colour mapping.
