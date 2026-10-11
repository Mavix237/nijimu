import { RefObject, useEffect, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
// Served by this site, from the installed package, so the engine always
// matches the library and can be cached for good.
import simdLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import simdWasmUrl from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import plainLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url";
import plainWasmUrl from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url";
// Google's float16 hand_landmarker.task (7.8 MB), gzipped to 5.8 MB.
import modelUrl from "../../assets/mediapipe/hand_landmarker.task.gz?url";

/** Google's copy of the same model, for browsers that cannot unpack gzip. */
const REMOTE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/** One landmark point in MediaPipe's normalized 0..1 space. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface UseHandTrackingOptions {
  /** Usually cameraPermission === "granted". When false, the camera is off. */
  enabled: boolean;
  /**
   * Build the tracker ahead of the camera (e.g. while the access dialog is
   * open), so allowing it only has to start the camera. Default false.
   */
  prepare?: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  /**
   * 1 for pinch gestures, 2 for two-hand distance gestures. Changing it
   * retunes the running tracker; the camera and model are kept.
   */
  numHands: 1 | 2;
  /**
   * Called every frame a hand is visible, with one entry per detected hand.
   * Gesture math lives at the call site — it differs per page.
   * Kept in a ref internally, so an inline arrow function is fine.
   */
  onLandmarks: (hands: Landmark[][]) => void;
  /** Called when the frame contained no hands. */
  onNoHands?: () => void;
}

export interface UseHandTrackingResult {
  /** True once the model is live and the detection loop is running. */
  isTracking: boolean;
  /** Set if camera access or model init failed; pages fall back to manual controls. */
  error: string | null;
}

interface TrackerAssets {
  HandLandmarker: typeof HandLandmarker;
  fileset: { wasmLoaderPath: string; wasmBinaryPath: string };
  /** The unpacked model, or null to let MediaPipe fetch Google's copy. */
  model: Uint8Array | null;
}

let assets: Promise<TrackerAssets> | null = null;

async function download(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Hand tracking files unavailable (${response.status})`);
  return response.arrayBuffer();
}

async function loadModel(): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  const bytes = new Uint8Array(await download(modelUrl));
  // a server that sent it with Content-Encoding: gzip has already unpacked it
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const unpacked = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(unpacked).arrayBuffer());
}

/**
 * The library, engine and model, downloaded once per visit and all at once.
 * The engine is held as blob URLs so every tracker built later (a retry, the
 * CPU fallback, the next page) starts without the network.
 */
function loadAssets(): Promise<TrackerAssets> {
  if (!assets) {
    assets = (async () => {
      const [vision, model] = await Promise.all([import("@mediapipe/tasks-vision"), loadModel()]);
      const simd = await vision.FilesetResolver.isSimdSupported();
      const [loader, wasm] = await Promise.all([
        download(simd ? simdLoaderUrl : plainLoaderUrl),
        download(simd ? simdWasmUrl : plainWasmUrl),
      ]);
      return {
        HandLandmarker: vision.HandLandmarker,
        fileset: {
          wasmLoaderPath: URL.createObjectURL(new Blob([loader], { type: "text/javascript" })),
          wasmBinaryPath: URL.createObjectURL(new Blob([wasm], { type: "application/wasm" })),
        },
        model,
      };
    })();
    // a failed download can be tried again
    assets.catch(() => { assets = null; });
  }
  return assets;
}

/** Start downloading hand tracking in the background, before the camera is asked for. */
export function preloadHandTracking(): void {
  loadAssets().catch(() => {});
}

async function createLandmarker(numHands: number): Promise<HandLandmarker> {
  const { HandLandmarker, fileset, model } = await loadAssets();
  const options = {
    numHands,
    runningMode: "VIDEO" as const,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };
  const source = model ? { modelAssetBuffer: model } : { modelAssetPath: REMOTE_MODEL_URL };
  try {
    return await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { ...source, delegate: "GPU" },
      ...options,
    });
  } catch {
    // GPU unavailable (sandboxed env / no WebGL) — fall back to CPU
    return HandLandmarker.createFromOptions(fileset, {
      baseOptions: { ...source, delegate: "CPU" },
      ...options,
    });
  }
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Camera + MediaPipe HandLandmarker lifecycle. The tracker is built once
 * (alongside the camera, not after it) and kept while the page wants hands:
 * changing `numHands` retunes it in place, and turning the camera off and
 * on again reuses it.
 */
export function useHandTracking({
  enabled,
  prepare = false,
  videoRef,
  numHands,
  onLandmarks,
  onNoHands,
}: UseHandTrackingOptions): UseHandTrackingResult {
  const [isTracking, setIsTracking] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loadFailed = useRef(false);

  // Callbacks live in refs so the effects don't re-run (and restart the
  // camera) when a page passes a fresh arrow function each render.
  const onLandmarksRef = useRef(onLandmarks);
  const onNoHandsRef = useRef(onNoHands);
  const enabledRef = useRef(enabled);
  const numHandsRef = useRef(numHands);
  /** The hand count the running tracker was built or last retuned for. */
  const tunedFor = useRef(numHands);
  useEffect(() => {
    onLandmarksRef.current = onLandmarks;
    onNoHandsRef.current = onNoHands;
    enabledRef.current = enabled;
    numHandsRef.current = numHands;
  });

  const wanted = enabled || prepare;

  // Turning the camera off clears its errors; turning it on again retries a
  // tracker that failed to build.
  useEffect(() => {
    if (!enabled) {
      setCameraError(null);
      setLoadError(null);
      return;
    }
    if (loadFailed.current) {
      loadFailed.current = false;
      setAttempt((n) => n + 1);
    }
  }, [enabled]);

  // The tracker.
  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    let made: HandLandmarker | null = null;
    tunedFor.current = numHandsRef.current;
    createLandmarker(tunedFor.current).then(
      (built) => {
        if (cancelled) { built.close(); return; }
        made = built;
        setLandmarker(built);
      },
      (err) => {
        if (cancelled) return;
        loadFailed.current = true;
        if (enabledRef.current) setLoadError(messageOf(err, "Hand tracking unavailable"));
      },
    );
    return () => {
      cancelled = true;
      made?.close();
      setLandmarker(null);
    };
  }, [wanted, attempt]);

  // One hand or two, on the tracker already running.
  useEffect(() => {
    if (!landmarker || tunedFor.current === numHands) return;
    tunedFor.current = numHands;
    landmarker.setOptions({ numHands }).catch(() => {});
  }, [landmarker, numHands]);

  // The camera, started at the same time as the tracker.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        const video = videoRef.current;
        if (cancelled || !video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play().catch(() => {});
        if (!cancelled) setStreaming(true);
      } catch (err) {
        if (!cancelled) setCameraError(messageOf(err, "Camera unavailable"));
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      setStreaming(false);
    };
  }, [enabled, videoRef]);

  // Detection, once both are ready: one pass per new camera frame.
  useEffect(() => {
    if (!enabled || !streaming || !landmarker) return;
    let rafId = 0;
    let lastFrame = -1;
    const detect = () => {
      const v = videoRef.current;
      if (v && v.readyState >= v.HAVE_ENOUGH_DATA && v.currentTime !== lastFrame) {
        lastFrame = v.currentTime;
        try {
          const results = landmarker.detectForVideo(v, performance.now());
          if (results.landmarks && results.landmarks.length > 0) {
            onLandmarksRef.current(results.landmarks as Landmark[][]);
          } else {
            onNoHandsRef.current?.();
          }
        } catch {
          // Transient per-frame detection errors are expected; keep looping.
        }
      }
      rafId = requestAnimationFrame(detect);
    };
    setIsTracking(true);
    detect();
    return () => {
      cancelAnimationFrame(rafId);
      setIsTracking(false);
    };
  }, [enabled, streaming, landmarker, videoRef]);

  return { isTracking, error: cameraError ?? loadError };
}

/** Euclidean distance between two landmarks (3D unless `flat`, which ignores z). */
export function landmarkDistance(a: Landmark, b: Landmark, flat = false): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = flat ? 0 : a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Average position of a hand's landmarks — its center point. */
export function handCenter(hand: Landmark[]): Landmark {
  const sum = hand.reduce(
    (acc, lm) => ({ x: acc.x + lm.x, y: acc.y + lm.y, z: acc.z + lm.z }),
    { x: 0, y: 0, z: 0 },
  );
  return { x: sum.x / hand.length, y: sum.y / hand.length, z: sum.z / hand.length };
}

/**
 * How open the hand is (0 ≈ fist, larger ≈ open palm).
 * Average fingertip distance from the palm (wrist + finger bases).
 * Used by the form-grow page: open palm → form, fist → sphere.
 */
export function handOpenness(hand: Landmark[]): number {
  const palmIdx = [0, 5, 9, 13, 17];
  const tipIdx = [4, 8, 12, 16, 20];
  let px = 0;
  let py = 0;
  let pz = 0;
  for (const i of palmIdx) {
    px += hand[i].x;
    py += hand[i].y;
    pz += hand[i].z;
  }
  px /= palmIdx.length;
  py /= palmIdx.length;
  pz /= palmIdx.length;
  let sum = 0;
  for (const i of tipIdx) {
    const dx = hand[i].x - px;
    const dy = hand[i].y - py;
    const dz = hand[i].z - pz;
    sum += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return sum / tipIdx.length;
}

/**
 * Debounced "the user actually moved" gate. Each page's first detected frame
 * becomes a baseline; the gesture only goes live after the pose changes by
 * `threshold` for `frames` consecutive frames — this is what stops the shape
 * from jumping the instant a hand appears.
 */
export function createGestureGate(threshold: number, frames = 3) {
  let baseline: number | null = null;
  let count = 0;
  let active = false;
  return {
    /** Feed the current raw measurement; returns true once the gesture is live. */
    update(value: number): boolean {
      if (baseline === null) {
        baseline = value;
        count = 0;
        active = false;
        return false;
      }
      if (Math.abs(value - baseline) > threshold) {
        count += 1;
        if (count >= frames) active = true;
      } else {
        count = 0;
      }
      return active;
    },
  };
}
