/** A chronological stream in perspective. Negative offsets recede to the
 * upper left; positive offsets approach the lower-right foreground.
 * Keep this projection shared by the ink hand-off and the artifact canvases. */
// Five visible older memories, plus one transparent guard for smooth scrolling.
export const CAROUSEL_OLDER_SEATS = 6;
export const CAROUSEL_NEWER_SEATS = 3;
/** Where the array first sat (a share of the screen's height)… */
const CAROUSEL_BASE_Y = 0.47;
/** …and how far it rises from there where the screen has room (2026-11-11). */
const CAROUSEL_LIFT_MAX = 0.02;
/** The gallery's "keep scrolling" tip (GalleryOnboarding: top 14.5vh, two 13px lines at
    1.5 leading) and the air kept under it: on a short window the memory in hand rises
    only as far as keeps it clear of the tip. */
const TIP_TOP = 0.145;
const TIP_HEIGHT_PX = 40;
const TIP_GAP_PX = 10;

/** How far the array has risen on this screen, a share of its height (0…CAROUSEL_LIFT_MAX).
    The caption under it (PuddleDiveGallery) rises by the same, so it keeps to its vessel. */
export function carouselLift(width: number, height: number) {
  const apexHalf = carouselSize(width, height) * 1.08 / 2;
  const clearY = (height * TIP_TOP + TIP_HEIGHT_PX + TIP_GAP_PX + apexHalf) / Math.max(1, height);
  return Math.max(0, Math.min(CAROUSEL_LIFT_MAX, CAROUSEL_BASE_Y - clearY));
}

/** A direct gallery visit should reveal the path, not start with its tail
 * entirely outside the archive. Explicit memory links still take priority. */
export function defaultCarouselIndex(count: number) {
  return Math.min(5, Math.max(0, count - 3));
}

/** 0 for a square or landscape screen, rising to 1 for an upright phone
 * (a little over twice as tall as it is wide). */
export function portraitTall(width: number, height: number) {
  return Math.min(1, Math.max(0, (1 - width / Math.max(1, height)) / 0.45));
}

function carouselSize(width: number, height: number) {
  // An upright phone has little width to share: the memory in hand takes a
  // larger part of it, reaching .42 of the width. Landscape is unchanged.
  const tall = portraitTall(width, height);
  return Math.min(Math.max(120, width * (0.26 + 0.16 * tall)), 360, height * 0.48);
}

export function carouselFrame(width: number, height: number) {
  return {
    cx: width * 0.5,
    apexY: height * (CAROUSEL_BASE_Y - carouselLift(width, height)),
    size: carouselSize(width, height),
  };
}

/** A shallow middle with two gently bending ends, not a sine-wave zigzag. */
function curveY(x: number, focusY: number) {
  const bend = (x - 0.5) * 2;
  return focusY + 0.055 * bend + 0.28 * bend ** 3;
}

export function carouselSeat(width: number, height: number, offset: number) {
  const frame = carouselFrame(width, height);
  // A pinhole projection compresses the distant spacing. Clamp only beyond
  // the mounted foreground, so a long archive never crosses the camera plane.
  const perspective = 1 / Math.max(0.28, 1 - offset * 0.18);
  // Open the whole stream slightly, with extra breathing room immediately
  // around the current memory. The smooth spread keeps scrolling continuous.
  const distance = Math.max(0, -offset);
  // Bring the outer foreground seat back toward its neighbour without
  // tightening the breathing room beside the focused memory.
  const approach = Math.max(0, Math.min(1, offset - 1));
  const foregroundPull = 0.1 * approach * approach * (3 - 2 * approach)
    * Math.exp(-(((offset - 2) / 0.65) ** 2));
  // Open the adjacent gaps locally, keeping the five distant seats in frame.
  const focusSpacing = 0.02 * offset * Math.exp(-offset * offset / 2);
  // An upright phone's larger seats need more road on the near side to
  // leave the screen before they unmount; the two nearest keep their seats.
  const tallSpread = 0.12 * portraitTall(width, height) * Math.max(0, offset - 2);
  const x = 0.5 + offset * 0.175 * perspective + 0.016 * Math.tanh(offset * 1.5) - foregroundPull + focusSpacing + tallSpread;
  // Stronger recession on the older side, with a smooth derivative at focus.
  const newer = Math.max(0, offset);
  const rightShrink = 0.1 * newer * newer * Math.exp(1 - newer * newer);
  // A modest emphasis at focus, easing away before either adjacent seat.
  const focusWeight = Math.max(0, 1 - offset * offset);
  const focusScale = 1 + 0.08 * focusWeight * focusWeight;
  const scale = perspective ** 1.6 * Math.exp(-0.15 * distance * distance / (1 + distance)) * (1 - rightShrink) * focusScale;
  const edge = Math.max(0, Math.min(1, CAROUSEL_OLDER_SEATS - distance));
  const opacity = (1 / (1 + distance * 0.13)) * edge * edge * (3 - 2 * edge);
  // Extra softness at the immediately adjacent seats, easing to zero at
  // focus and before the second neighbour on either side.
  const neighborWeight = Math.max(0, 1 - (Math.abs(offset) - 1) ** 2);
  const neighborBlur = 1.0 * neighborWeight * neighborWeight;
  return {
    // A small horizontal nudge for the outer right seat; retain its height.
    x: width * (x + foregroundPull * 0.2),
    // Lift the outer right seat, blending back into the path during scrolling.
    y: height * (curveY(x, frame.apexY / Math.max(1, height)) - foregroundPull * 0.8),
    size: frame.size * scale,
    scale,
    opacity,
    // The filter sits inside the scaled seat: compensate so its apparent
    // blur increases away from focus on BOTH sides, regardless of scale.
    blurPx: (1.5 * Math.abs(offset) ** 1.25 + neighborBlur) * 0.92 / scale,
  };
}

export function carouselContainsOffset(offset: number) {
  return offset >= -CAROUSEL_OLDER_SEATS && offset <= CAROUSEL_NEWER_SEATS;
}

/** First collect all ink pointers into a compact, date-ordered S. Then the
 * camera opens this path into carouselSeat's deeper perspective. */
export function inkCurvePoint(width: number, height: number, index: number, count: number) {
  const x = count <= 1 ? 0.5 : 0.07 + 0.86 * index / (count - 1);
  // Invert the base perspective projection for the compact gathering path,
  // then use the same depth scale as the fully opened gallery.
  const offset = (x - 0.5) / (0.175 + 0.18 * (x - 0.5));
  return { ...carouselSeat(width, height, offset), offset };
}

/** Move along the projected path, not the straight chord to a distant point.
 * Every pointer keeps extending through space, including unmounted seats. */
export function inkUnfoldSeat(width: number, height: number, index: number, count: number, focusIndex: number, progress: number) {
  const start = inkCurvePoint(width, height, index, count);
  const t = Math.max(0, Math.min(1, progress));
  const offset = start.offset + (index - focusIndex - start.offset) * t;
  return carouselSeat(width, height, offset);
}
