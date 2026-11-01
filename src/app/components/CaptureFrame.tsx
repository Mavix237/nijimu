import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

/** Marks the canvas that owns this scene as a layer of the page snapshot. */
export function CaptureFrame() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    el.dataset.captureFrame = "";
    return () => { delete el.dataset.captureFrame; };
  }, [gl]);
  return null;
}
