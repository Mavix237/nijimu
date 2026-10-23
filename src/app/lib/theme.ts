import { INK } from "./colors";
import { SERIF_GARAMOND } from "./serifPreview";

// Shared font stacks — the single place to change typography.
// SERIF is Latin-first: English renders in Rowan; CJK glyphs fall through to
// self-hosted GenRyuMin2 TW (see fonts.css).
/** Rowan, or — while the temporary serif preview is on (serifPreview.ts) —
 * EB Garamond in every serif stack, scaled to Rowan's x-height (fonts.css). */
const LATIN_SERIF = SERIF_GARAMOND ? "'EB Garamond Preview'" : "Rowan";
export const SERIF = `${LATIN_SERIF}, 'GenRyuMin2 TW', Georgia, serif`;
/** A hair of air for Rowan italic titles — the italic sits tight without it. */
export const SERIF_ITALIC_TRACKING = "0.012em";
export const SERIF_CJK = `'GenRyuMin2 TW', ${LATIN_SERIF}, Georgia, serif`;
/** The spoken words: EB Garamond (fonts.css). */
export const SERIF_DISPLAY = `'EB Garamond', ${LATIN_SERIF}, 'GenRyuMin2 TW', Georgia, serif`;
export const SERIF_EXPOSURE = SERIF_GARAMOND ? SERIF : "'Exposure Trial', Rowan, 'GenRyuMin2 TW', Georgia, serif";
/** Self-hosted Roboto (fonts.css), so the sans is the same on every platform. */
export const SANS = "Roboto, 'Helvetica Neue', Arial, sans-serif";
export const SANS_UI = SANS;
/** The sans scale: four sizes, two weights (400, and 500 for what leads).
 * `micro` is the only size that is tracked out. */
export const SANS_TYPE = {
  micro: { fontSize: 11, letterSpacing: "0.04em" },
  ui: { fontSize: 13, letterSpacing: "0.01em" },
  option: { fontSize: 15, letterSpacing: 0 },
  title: { fontSize: 19, letterSpacing: "-0.005em" },
} as const;
/** Quiet captions — transcribing, recording notes, pane asides. */
export const NOTE_SIZE = "clamp(11px, 2.4vw, 12px)";
/** Uppercase meta labels. */
export const LABEL_SIZE = "clamp(10px, 2.2vw, 11px)";
export const META = {
  fontFamily: SANS,
  fontSize: LABEL_SIZE,
  fontWeight: 500,
  letterSpacing: "0.04em",
  color: INK.body,
  textTransform: "uppercase",
} as const;
/** Pane body copy and highlight prompts. */
export const BODY_SIZE = "clamp(14px, 3.2vw, 15px)";
/** Shared size for instructional copy (pond invitation, thought prompts, hold hint). */
export const INSTRUCTION_SIZE = "clamp(14px, 3.2vw, 16px)";
/** Small sans prompts floating above the create-memory pond's ripples. */
export const POND_PROMPT_SIZE = "clamp(12px, 2.8vw, 13px)";
/** Spoken transcript on the pond. */
/** EB Garamond's small x-height sets it about a tenth larger than the face it replaced. */
export const PROSE_SIZE = "clamp(14px, 2.7vw, 17px)";
/** Naming step: the same words above the vessel, at four-fifths the pond size. */
export const NAMING_PROSE_SIZE = `calc(${PROSE_SIZE} * 0.8)`;
/** Wash behind a word the highlight step has lifted. */
export const TRANSCRIPT_HIGHLIGHT = "rgba(123, 123, 135, 0.22)";
/** EB Garamond, as the pond sets the spoken words. Color stays with the page. */
export const TRANSCRIPT = {
  fontFamily: SERIF_DISPLAY,
  fontSize: PROSE_SIZE,
  fontWeight: 400,
  lineHeight: 1.45,
  letterSpacing: "0.01em",
  fontFeatureSettings: '"kern" 1',
  fontKerning: "normal",
} as const;
/** The transcript's measure, in its own font's `ch`; other copy that should
 * share it sets this width on a box in `TRANSCRIPT`'s family and size. */
export const TRANSCRIPT_WIDTH = "min(80ch, 100%)";
/** A memory's words in the gallery — the cursor's trail and the full transcript
    under the year set alike. The size is 0.9vw between 12 and 14px; the trail
    measures its words with these numbers. */
export const GALLERY_TRANSCRIPT_SIZE = { vw: 0.9, min: 12, max: 14 } as const;
export const GALLERY_TRANSCRIPT = {
  color: "#a4a4ab",
  fontFamily: SERIF,
  fontWeight: 400,
  fontSize: `clamp(${GALLERY_TRANSCRIPT_SIZE.min}px, ${GALLERY_TRANSCRIPT_SIZE.vw}vw, ${GALLERY_TRANSCRIPT_SIZE.max}px)`,
} as const;
/** Pill and text-button labels. Primary and secondary share this size. */
export const BUTTON_SIZE_SM = "clamp(13px, 2.6vw, 14px)";
/** Shared dialog action spacing, including the pane's compensating bottom inset. */
export const PANE_ACTION = { paddingY: 14, borderOpacity: 25 } as const;
/** Dialog title-to-instructions gap; instructions-to-actions uses 1.5× this. */
export const PANE_CONTENT_GAP = 14;
/** Exposure title — glass panes and pond overlay headings. */
export const TITLE_SIZE = "clamp(20px, 4.6vw, 24px)";
export const TITLE_TRACKING = "0.01em";
export const TITLE = {
  fontFamily: SERIF_EXPOSURE,
  fontSize: TITLE_SIZE,
  fontWeight: 400,
  lineHeight: "140%",
  letterSpacing: TITLE_TRACKING,
  fontSynthesis: "none",
} as const;

/** Shared copy entrance: fade and a little blur, no rise. Objects and
    ParticleText keep their own motion. */
export const TEXT_ENTER_MS = 700;
export const TEXT_ENTER_BLUR = "4px";
export const textEnter = (ms = TEXT_ENTER_MS) =>
  `nijimuTextIn ${ms}ms ease both` as const;

/** Current create-flow grid. Change these once to move every screen's rows. */
export const FLOW_PAGE = {
  navigationTop: 30,
  navigationHeight: 76,
  headingTop: "clamp(132px, 22vh, 176px)",
  headingWidth: "min(28em, 100%)",
  /** Naming vessel, above the centre of the scene once the rise has landed. */
  namingArtifactRaise: "14vh",
  actionHeight: 45,
  actionBottom: "max(72px, env(safe-area-inset-bottom))",
  /** Above the water (recording, transcript, naming) the actions sit higher. */
  surfaceActionBottom: "max(120px, env(safe-area-inset-bottom))",
  /** How much higher that is than `actionBottom`, where a screen keeps its rows. */
  surfaceActionLift: "48px",
} as const;

/** Phone-only handling layout: shape, rhythm, distance and colour. */
export const UNDERWATER_PHONE = {
  headingTop: "max(env(safe-area-inset-top, 0px), clamp(104px, 15dvh, 124px))",
  /** The step's English name under its character, and the instructions below. */
  labelSize: 11,
  instructionSize: 13,
  /** The instructions' measure, narrower than the heading row (≈ 220px at 11px). */
  instructionWidth: "20em",
  instructionGap: 14,
  /** How far below the view's centre the handled form sits, as a share of the view's height. */
  artifactDrop: .015,
  /** The foot row — gesture, camera, continue — and the slider above it. */
  rowHeight: 80,
  rowBottom: "max(24px, env(safe-area-inset-bottom, 0px))",
  sliderGap: 24,
} as const;
