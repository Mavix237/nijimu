import type { CSSProperties } from "react";
import { galleryTune, useGalleryTuneVersion } from "../lib/galleryTune";
import { fineGrainSize, fineGrainTiles, fineOpacity, finishScale, toothTile, useFinishMode } from "../lib/paperFinish";

/**
 * The gallery's paper finish as layers (lib/paperFinish.ts), read live from
 * the "gallery ground" panel — the fine grain's strength is its backdrop
 * grain, the tooth and tint its texture — so that one panel tunes every
 * screen past Enter. `fine` adds the fine grain, for a surface whose own
 * shaders do not (the pond stage) or whose blur has taken it away (a pane).
 * A phone draws it finer and fainter (`finishScale`); the finish mode
 * (full / lite / off) can thin or remove it where it costs too much.
 * Fills its positioned parent; `radius` follows a rounded one.
 */
export function PaperFinish({ zIndex, fine = false, radius }: { zIndex?: number; fine?: boolean; radius?: CSSProperties["borderRadius"] }) {
  useGalleryTuneVersion();
  const mode = useFinishMode();
  if (mode === "off") return null;
  const { texture: t, backdrop } = galleryTune();
  const scale = finishScale();
  const layer: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none", borderRadius: radius, zIndex };
  const full = mode === "full";
  const toothSize = t.size * scale.toothSize;
  return (
    <>
      {full && t.tintAmount > 0 && (
        <div aria-hidden style={{ ...layer, background: t.tint, opacity: t.tintAmount,
          mixBlendMode: t.tintBlend as CSSProperties["mixBlendMode"] }} />
      )}
      {fine && backdrop.grain > 0 && (() => {
        const tiles = fineGrainTiles(), size = `${fineGrainSize()}px ${fineGrainSize()}px`;
        const o = fineOpacity(backdrop.grain, mode);
        return <>
          <div aria-hidden style={{ ...layer, backgroundImage: `url(${tiles.dark})`, backgroundSize: size, opacity: o.dark }} />
          {o.light > 0 && <div aria-hidden style={{ ...layer, backgroundImage: `url(${tiles.light})`, backgroundSize: size, opacity: o.light,
            mixBlendMode: "plus-lighter" as CSSProperties["mixBlendMode"] }} />}
        </>;
      })()}
      {full && t.amount > 0 && (
        <div aria-hidden style={{ ...layer, backgroundImage: `url(${toothTile()})`,
          backgroundSize: `${toothSize}px ${toothSize}px`, opacity: t.amount * scale.tooth,
          filter: t.contrast !== 1 ? `contrast(${t.contrast})` : undefined,
          mixBlendMode: t.blend as CSSProperties["mixBlendMode"] }} />
      )}
    </>
  );
}
