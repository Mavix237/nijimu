/**
 * Smoothed rounded rectangle — Figma's "corner smoothing", after figma-squircle
 * (MIT, phamfoo). Each corner is an arc in its middle eased into the edges by
 * two cubic Béziers, so the curvature has no step where edge meets corner.
 * `smoothing` 0 is a plain rounded rect, 0.6 is the iOS-like default.
 */

const rad = (deg: number) => (deg * Math.PI) / 180;

export function squirclePath(width: number, height: number, radius: number, smoothing: number): string {
  const w = Math.max(width, 0);
  const h = Math.max(height, 0);
  const budget = Math.min(w, h) / 2;
  const r = Math.min(radius, budget);
  if (r <= 0) return `M0 0H${w}V${h}H0Z`;

  const s = Math.max(0, Math.min(smoothing, budget / r - 1));
  const p = Math.min((1 + s) * r, budget);
  const arcMeasure = 90 * (1 - s);
  const arc = Math.sin(rad(arcMeasure / 2)) * r * Math.SQRT2;
  const alpha = (90 - arcMeasure) / 2;
  const p3ToP4 = r * Math.tan(rad(alpha / 2));
  const beta = 45 * s;
  const c = p3ToP4 * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const b = (p - arc - c - d) / 3;
  const a = 2 * b;
  const n = (v: number) => +v.toFixed(3);
  const [A, AB, ABC, BC, D, C, R, ARC] = [a, a + b, a + b + c, b + c, d, c, r, arc].map(n);

  return [
    `M${n(w - p)} 0`,
    `c${A} 0 ${AB} 0 ${ABC} ${D}`,
    `a${R} ${R} 0 0 1 ${ARC} ${ARC}`,
    `c${D} ${C} ${D} ${BC} ${D} ${ABC}`,
    `L${w} ${n(h - p)}`,
    `c0 ${A} 0 ${AB} ${-D} ${ABC}`,
    `a${R} ${R} 0 0 1 ${-ARC} ${ARC}`,
    `c${-C} ${D} ${-BC} ${D} ${-ABC} ${D}`,
    `L${n(p)} ${h}`,
    `c${-A} 0 ${-AB} 0 ${-ABC} ${-D}`,
    `a${R} ${R} 0 0 1 ${-ARC} ${-ARC}`,
    `c${-D} ${-C} ${-D} ${-BC} ${-D} ${-ABC}`,
    `L0 ${n(p)}`,
    `c0 ${-A} 0 ${-AB} ${D} ${-ABC}`,
    `a${R} ${R} 0 0 1 ${ARC} ${-ARC}`,
    `c${C} ${-D} ${BC} ${-D} ${ABC} ${-D}`,
    "Z",
  ].join("");
}
