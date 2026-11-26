import { useMemo, type CSSProperties } from "react";
import { grainMaskTile } from "../lib/paperFinish";

/** Words that come in line by line as ink into wet paper — the gallery transcript's entrance, shared.
    Each line fades in (ease in and out, LINE_INK_MS, LINE_STEP_MS after the one above) as a faint
    wash: a soft halo of its ink (INK_HALO_EM) held in the paper's grain (grainMaskTile, one grain a
    device pixel, as on the landing), barely blurred (INK_BLUR_PX). A wet front then runs across it
    from the left (INK_FRONT, its soft width), filling the ink in solid while the halo draws back into
    the letters. A settled line keeps no mask, shadow or filter. */
export const LINE_INK_MS = 1600;
export const LINE_STEP_MS = 260;
/** The gallery transcript's lead before its first line. */
export const LINE_LEAD_MS = 150;
const INK_HALO_EM = [0.32, 0.85] as const;
const INK_BLUR_PX = 1.1;
/** The front's solid share and its soft edge, as stops along a mask 2.2× the line's width. */
const INK_FRONT = [50, 60] as const;

/** The ink entrance as keyframes named `name`, in the ink `ink` (#rrggbb). Its mask holds through the
    animation and is gone once a line has settled (fill backwards), so a settled line is plain text. */
export function inkKeyframes(name: string, ink: string) {
  const rgb = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16)).join(", ");
  const grain = grainMaskTile();
  const dpr = typeof window === "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1);
  const tile = `${(256 / dpr).toFixed(2)}px ${(256 / dpr).toFixed(2)}px`;
  const front = `linear-gradient(90deg, #000 ${INK_FRONT[0]}%, transparent ${INK_FRONT[1]}%)`;
  const mask = (x: string) => `
    -webkit-mask-image: ${front}, url(${grain}); mask-image: ${front}, url(${grain});
    -webkit-mask-size: 220% 100%, ${tile}; mask-size: 220% 100%, ${tile};
    -webkit-mask-repeat: no-repeat, repeat; mask-repeat: no-repeat, repeat;
    -webkit-mask-position: ${x} 0, 0 0; mask-position: ${x} 0, 0 0;
    -webkit-mask-composite: source-over; mask-composite: add;`;
  return `
    @keyframes ${name} {
      from {
        opacity: 0; color: rgba(${rgb}, .45); filter: blur(${INK_BLUR_PX}px);
        text-shadow: 0 0 ${INK_HALO_EM[0]}em rgba(${rgb}, .45), 0 0 ${INK_HALO_EM[1]}em rgba(${rgb}, .22);
        ${mask("100%")}
      }
      35% { opacity: .9; }
      /* the halo draws back into the letters ahead of the front, so the ink the front
         fills reads as the word, not as a smudge round it */
      55% {
        color: rgba(${rgb}, .8); filter: blur(${(INK_BLUR_PX * 0.25).toFixed(2)}px);
        text-shadow: 0 0 ${(INK_HALO_EM[0] * 0.35).toFixed(2)}em rgba(${rgb}, .18), 0 0 ${(INK_HALO_EM[1] * 0.35).toFixed(2)}em rgba(${rgb}, .06);
      }
      to {
        opacity: 1; color: rgba(${rgb}, 1); filter: blur(0px);
        text-shadow: 0 0 0 rgba(${rgb}, 0), 0 0 0 rgba(${rgb}, 0);
        ${mask("0%")}
      }
    }`;
}

/** One line of inked words: a block with half an em of room above and below for the halo (taken
    back by margins — its parent must be `flow-root`), unseen until `play`, then inked in after
    `delayMs`. With reduced motion it simply shows. */
export function inkLineStyle(name: string, index: number, count: number, play: boolean, delayMs: number): CSSProperties {
  const still = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return {
    display: "block",
    padding: "0.5em 0",
    marginTop: index === 0 ? "-0.5em" : "-1em",
    marginBottom: index === count - 1 ? "-0.5em" : 0,
    opacity: play || still ? undefined : 0,
    animation: play && !still ? `${name} ${LINE_INK_MS}ms ease-in-out ${delayMs + index * LINE_STEP_MS}ms backwards` : "none",
  };
}

/** Lines of words inked in (inkLineStyle), with their keyframes; put them in a `flow-root` block. */
export function InkLines({ lines, ink, name, play, delayMs = 0 }: {
  lines: string[]; ink: string; name: string; play: boolean; delayMs?: number;
}) {
  const keyframes = useMemo(() => inkKeyframes(name, ink), [name, ink]);
  return <>
    <style>{keyframes}</style>
    {lines.map((line, i) => <span key={i} style={inkLineStyle(name, i, lines.length, play, delayMs)}>{line}</span>)}
  </>;
}
