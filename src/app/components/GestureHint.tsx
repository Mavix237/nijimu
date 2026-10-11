import type { CSSProperties } from "react";
import shapePalmUrl from "../../assets/gesture-shape-palm.png";
import shapePrayerUrl from "../../assets/gesture-shape-prayer.png";
import feelingHandUrl from "../../assets/gesture-feeling-horizontal.png";
import distanceOpenUrl from "../../assets/gesture-distance-open.png";
import colorPinchUrl from "../../assets/gesture-color-pinch.png";
import rhythmPinchUrl from "../../assets/gesture-rhythm-pinch.gif";
import rhythmStillUrl from "../../assets/gesture-rhythm-pinch-still.png";

export type GestureHintKind = "shape" | "rhythm" | "feeling" | "distance" | "color";

/** What each illustration actually covers, in its own px, centred in its stage —
    the drawn image plus the ground its animation travels over (the palms
    parting ±36px, the colour hand sweeping ±18px, the feeling hand lifting
    ±8px, the open palm drifting to 1.06×). Keep in step with the sizes and keyframes below. A row that fits
    the illustrations to its height reads these. */
export const GESTURE_EXTENT: Record<GestureHintKind, { w: number; h: number }> = {
  shape: { w: 36 * 2 + 56, h: 80 },
  rhythm: { w: 70, h: 84 },
  feeling: { w: 84, h: 42 + 16 },
  distance: { w: 74 * 1.06, h: 74 * 1.06 },
  color: { w: 58 + 18 * 2, h: 58 },
};

export function GestureHint({
  kind,
  active,
  style,
}: {
  kind: GestureHintKind;
  active: boolean;
  /** Overrides the default seat under the copy, so a screen can set it above its camera. */
  style?: CSSProperties;
}) {
  return (
    <div
      className="nijimu-gesture-hint"
      aria-hidden
      data-kind={kind}
      style={{
        position: "absolute",
        top: 210,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        pointerEvents: "none",
        display: "block",
        width: kind === "shape" ? 180 : 96,
        height: 88,
        /* `active` means a real hand is driving the gesture — hide the hint. */
        opacity: active ? 0 : 0.92,
        transition: "opacity 0.9s ease",
        ...style,
      }}
    >
      {/* key remounts the frames so tab switches always restart a visible cycle */}
      <div key={kind} className="nijimu-gesture-hint-stage">
        {kind === "shape" ? (
          <>
            <img className="nijimu-gesture-shape-prayer" src={shapePrayerUrl} alt="" />
            <img className="nijimu-gesture-shape-left" src={shapePalmUrl} alt="" />
            <img className="nijimu-gesture-shape-right" src={shapePalmUrl} alt="" />
          </>
        ) : kind === "rhythm" ? (
          <picture>
            <source media="(prefers-reduced-motion: reduce)" srcSet={rhythmStillUrl} />
            <img className="nijimu-gesture-rhythm" src={rhythmPinchUrl} alt="" width={320} height={384} />
          </picture>
        ) : kind === "feeling" ? (
          <img className="nijimu-gesture-feeling" src={feelingHandUrl} alt="" />
        ) : kind === "color" ? (
          <img className="nijimu-gesture-color" src={colorPinchUrl} alt="" />
        ) : (
          <img className="nijimu-gesture-distance-open" src={distanceOpenUrl} alt="" />
        )}
      </div>

      <style>{`
        .nijimu-gesture-hint-stage {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .nijimu-gesture-rhythm { width: 70px; height: 84px; }
        .nijimu-gesture-hint img {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          margin: auto;
          display: block;
          object-fit: contain;
          max-width: none;
        }
        /* Sized so stroke weight matches feeling (~84px wide). */
        .nijimu-gesture-shape-prayer {
          width: 64px;
          height: 80px;
          animation: nijimuGesturePrayer 2.8s ease-in-out infinite;
        }
        .nijimu-gesture-shape-left,
        .nijimu-gesture-shape-right {
          width: 56px;
          height: 78px;
        }
        .nijimu-gesture-shape-left {
          animation: nijimuGestureShapeLeft 2.8s ease-in-out infinite;
        }
        .nijimu-gesture-shape-right {
          animation: nijimuGestureShapeRight 2.8s ease-in-out infinite;
        }
        .nijimu-gesture-feeling {
          width: 84px;
          height: 42px;
          opacity: 1;
          animation: nijimuGestureLift 2.4s ease-in-out infinite;
        }
        .nijimu-gesture-color {
          width: 58px;
          height: 58px;
          opacity: 1;
          animation: nijimuGestureColorSweep 2.8s ease-in-out infinite;
        }
        .nijimu-gesture-distance-open {
          width: 74px;
          height: 74px;
          /* slow and soft: a hand drifting toward the camera, not shoving */
          animation: nijimuGesturePalm 4.6s cubic-bezier(.45, 0, .55, 1) infinite;
        }

        /* Prayer fades out; two upright palms slide apart in parallel. */
        @keyframes nijimuGesturePrayer {
          0%, 18% { opacity: 1; transform: translateY(2px); }
          40%, 70% { opacity: 0; transform: translateY(0); }
          92%, 100% { opacity: 1; transform: translateY(2px); }
        }
        @keyframes nijimuGestureShapeLeft {
          0%, 18% { opacity: 0; transform: translateX(-6px) scaleX(-1); }
          40%, 70% { opacity: 1; transform: translateX(-36px) scaleX(-1); }
          92%, 100% { opacity: 0; transform: translateX(-6px) scaleX(-1); }
        }
        @keyframes nijimuGestureShapeRight {
          0%, 18% { opacity: 0; transform: translateX(6px); }
          40%, 70% { opacity: 1; transform: translateX(36px); }
          92%, 100% { opacity: 0; transform: translateX(6px); }
        }
        @keyframes nijimuGestureLift {
          0%, 14% { transform: translateY(8px); }
          50%, 64% { transform: translateY(-8px); }
          100% { transform: translateY(8px); }
        }
        @keyframes nijimuGestureColorSweep {
          0%, 12% { transform: translateX(-18px); }
          50%, 62% { transform: translateX(18px); }
          100% { transform: translateX(-18px); }
        }
        @keyframes nijimuGesturePalm {
          0%, 14%, 100% { opacity: .6; transform: scale(.72); }
          52%, 72% { opacity: 1; transform: scale(1.06); }
        }

        @media (prefers-reduced-motion: reduce) {
          .nijimu-gesture-hint img {
            animation: none !important;
          }
          .nijimu-gesture-shape-prayer { opacity: 0; }
          .nijimu-gesture-shape-left { opacity: 1; transform: translateX(-36px) scaleX(-1); }
          .nijimu-gesture-shape-right { opacity: 1; transform: translateX(36px); }
          .nijimu-gesture-feeling { opacity: 1; transform: none; }
          .nijimu-gesture-color { opacity: 1; transform: none; }
          .nijimu-gesture-distance-open { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
