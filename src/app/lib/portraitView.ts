import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import type * as THREE from "three";

/** Narrower than this, a scene keeps the side-to-side view it has at this
    aspect: a phone held upright sees as much across as a slightly tall
    window would, and more above and below. */
export const PORTRAIT_FIT_ASPECT = 0.8;

/** The camera zoom (≤ 1) that widens a vertical fov for a tall canvas. */
export function portraitZoom(aspect: number, fit = PORTRAIT_FIT_ASPECT): number {
  return aspect >= fit ? 1 : Math.max(0.2, aspect / fit);
}

/** tan of half the vertical view the camera actually shows, zoom included —
    for code that sizes things on screen from `fov`. */
export function viewHalfTan(camera: THREE.PerspectiveCamera): number {
  return Math.tan((camera.fov * Math.PI) / 360) / (camera.zoom || 1);
}

/** Put inside a <Canvas>: keeps the perspective camera's zoom fitted to the
    canvas aspect. The scene's own fov, and any fov it animates, are left
    alone — the zoom applies on top. */
export function PortraitFit({ fit = PORTRAIT_FIT_ASPECT }: { fit?: number }) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  useLayoutEffect(() => {
    if (!(camera as THREE.PerspectiveCamera).isPerspectiveCamera) return;
    camera.zoom = portraitZoom(width / Math.max(1, height), fit);
    camera.updateProjectionMatrix();
  }, [camera, width, height, fit]);
  return null;
}
