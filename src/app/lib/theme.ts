// Shared font stacks — the single place to change typography.
// SERIF is Latin-first: English renders in Rowan; CJK glyphs fall through to
// self-hosted GenRyuMin2 TW (see fonts.css).
export const SERIF = "Rowan, 'GenRyuMin2 TW', Georgia, serif";
/** A hair of air for Rowan italic titles — the italic sits tight without it. */
export const SERIF_ITALIC_TRACKING = "0.012em";
export const SERIF_CJK = "'GenRyuMin2 TW', Rowan, Georgia, serif";
export const SERIF_DISPLAY = "'Exposure Trial Plus', Rowan, 'GenRyuMin2 TW', Georgia, serif";
export const SERIF_EXPOSURE = "'Exposure Trial', Rowan, 'GenRyuMin2 TW', Georgia, serif";
export const SANS = "Switzer, sans-serif";
export const SANS_UI = "'SF Pro', system-ui, sans-serif";
/** Quiet captions — transcribing, recording notes, pane asides. */
export const NOTE_SIZE = "clamp(11px, 2.4vw, 12px)";
/** Uppercase meta labels. */
export const LABEL_SIZE = "clamp(10px, 2.2vw, 11px)";
export const META = {
  fontFamily: SANS,
  fontSize: LABEL_SIZE,
  fontWeight: 500,
  letterSpacing: "0.5px",
  color: "#9b9ba3",
  textTransform: "uppercase",
} as const;
/** Pane body copy and highlight prompts. */
export const BODY_SIZE = "clamp(14px, 3.2vw, 15px)";
/** Shared size for instructional copy (pond invitation, thought prompts, hold hint). */
export const INSTRUCTION_SIZE = "clamp(14px, 3.2vw, 16px)";
/** Spoken transcript on the pond. */
export const PROSE_SIZE = "clamp(13px, 2.4vw, 15px)";
/** Naming step: the same words above the vessel, at four-fifths the pond size. */
export const NAMING_PROSE_SIZE = `calc(${PROSE_SIZE} * 0.8)`;
/** Wash behind a word the highlight step has lifted. */
export const TRANSCRIPT_HIGHLIGHT = "rgba(123, 123, 135, 0.22)";
/** Exposure Trial Plus, as the pond sets the spoken words. Color stays with the page. */
export const TRANSCRIPT = {
  fontFamily: SERIF_DISPLAY,
  fontSize: PROSE_SIZE,
  fontWeight: 400,
  lineHeight: 1.45,
  letterSpacing: "0.02em",
  fontFeatureSettings: '"kern" 1',
  fontKerning: "normal",
} as const;
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

/** Current create-flow grid. Change these once to move every screen's rows. */
export const FLOW_PAGE = {
  navigationTop: 30,
  navigationHeight: 76,
  headingTop: "clamp(132px, 22vh, 176px)",
  headingWidth: "min(28em, 100%)",
  /** Naming vessel, above the centre of the scene once the rise has landed. */
  namingArtifactRaise: "14vh",
  actionHeight: 45,
  actionBottom: "max(40px, env(safe-area-inset-bottom))",
} as const;

/** Phone-only handling layout: shape, rhythm, distance and colour. */
export const UNDERWATER_PHONE = {
  headingTop: "max(env(safe-area-inset-top, 0px), clamp(118px, 17dvh, 140px))",
  instructionSize: 13,
  instructionGap: 14,
  /** How far below the view's centre the handled form sits, as a share of the view's height. */
  artifactDrop: .045,
  /** The foot row — gesture, camera, continue — and the slider above it. */
  rowHeight: 52,
  rowBottom: "max(24px, env(safe-area-inset-bottom, 0px))",
  sliderGap: 24,
} as const;
