/**
 * A photograph of the page the browser has already composited.
 *
 * The picture is the tab's own pixels, including WebGL, paper grain and CSS
 * overlays. "Picture" hides words and controls for that one frame. "With ui"
 * leaves them. The render menu itself stays out of both. Nothing is redrawn
 * at another size: the file is the screen's own pixel size.
 */

import { freezeCapture } from "./captureFreeze";

export type CaptureRequest = {
  /** Keep the page's words and controls. The render menu is left out either way. */
  includeUi: boolean;
};

export type CaptureResult = { width: number; height: number };

const UI = [
  "[data-render-menu]",
  "[data-pond-header]",
  "[data-tune-panel]",
  "[data-export-hide]",
  ".dialkit-root",
  ".dialkit-panel",
  ".lab-dock",
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "label",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "[data-pond-prompt]",
  "#pond-hold-help",
  "[role='slider']",
  "[role='dialog']",
].join(",");

type FrameGrabber = { grabFrame: () => Promise<ImageBitmap> };

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function within<T>(ms: number, work: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("couldn't capture")), ms);
    work.then(resolve, reject).finally(() => window.clearTimeout(timer));
  });
}

function keepsThePicture(el: Element): boolean {
  if (el.closest("canvas")) return true;
  if (el.matches("canvas, [data-capture-frame], [data-capture-plate]")) return true;
  if (el.hasAttribute("data-capture-root")) return true;
  if (el.querySelector("canvas, [data-capture-frame]")) return true;
  return false;
}

/** Hide chrome without changing layout. Returns the restore. */
function conceal(includeUi: boolean): () => void {
  const style = document.createElement("style");
  style.textContent = '[data-capture-ui="1"]{visibility:hidden !important}';
  document.head.appendChild(style);
  const marked: Element[] = [];
  const mark = (el: Element) => {
    if (el.getAttribute("data-capture-ui") === "1") return;
    el.setAttribute("data-capture-ui", "1");
    marked.push(el);
  };
  for (const el of document.querySelectorAll("[data-render-menu], [data-render-menu] *")) mark(el);
  if (!includeUi) {
    for (const el of document.querySelectorAll(UI)) {
      if (keepsThePicture(el)) continue;
      mark(el);
    }
  }
  return () => {
    style.remove();
    for (const el of marked) el.removeAttribute("data-capture-ui");
  };
}

async function grab(track: MediaStreamTrack): Promise<ImageBitmap> {
  const Capture = (globalThis as unknown as { ImageCapture?: new (track: MediaStreamTrack) => FrameGrabber }).ImageCapture;
  if (Capture && track.readyState === "live") {
    try {
      const frames = new Capture(track);
      let last: ImageBitmap | null = null;
      for (let i = 0; i < 3; i++) {
        const frame = await within(800, frames.grabFrame());
        last?.close();
        last = frame;
        if (frame.width > 2 && frame.height > 2 && i > 0) return frame;
        await nextPaint();
      }
      if (last && last.width > 2) return last;
      last?.close();
    } catch {
      /* The video element below reads the same track. */
    }
  }
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([track]);
  try {
    await video.play();
    for (let i = 0; i < 8 && video.videoWidth < 2; i++) await nextPaint();
    if (video.videoWidth < 2) throw new Error("couldn't capture");
    await nextPaint();
    return await createImageBitmap(video);
  } finally {
    video.srcObject = null;
  }
}

function save(bitmap: ImageBitmap): Promise<CaptureResult> {
  const page = document.createElement("canvas");
  page.width = bitmap.width;
  page.height = bitmap.height;
  const ctx = page.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return Promise.reject(new Error("couldn't capture"));
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => {
    page.toBlob((blob) => {
      if (!blob) {
        reject(new Error("couldn't capture"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nijimu-${page.width}x${page.height}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      resolve({ width: page.width, height: page.height });
    }, "image/png");
  });
}

function asError(error: unknown): Error {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) {
    return new Error("cancelled");
  }
  if (error instanceof Error && (error.message === "cancelled" || error.message === "couldn't capture")) return error;
  return new Error("couldn't capture");
}

/**
 * Share the current tab, then read one frame of what the browser is showing.
 * The share ends as soon as that frame is taken.
 */
export async function capturePage(request: CaptureRequest): Promise<CaptureResult> {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("couldn't capture");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      monitorTypeSurfaces: "exclude",
      surfaceSwitching: "exclude",
    } as DisplayMediaStreamOptions);
  } catch (error) {
    throw asError(error);
  }
  const track = stream.getVideoTracks()[0];
  if (!track) {
    for (const item of stream.getTracks()) item.stop();
    throw new Error("couldn't capture");
  }
  const release = freezeCapture();
  const restore = conceal(request.includeUi);
  try {
    await nextPaint();
    const bitmap = await grab(track);
    return await save(bitmap);
  } catch (error) {
    throw asError(error);
  } finally {
    restore();
    release();
    track.stop();
    for (const item of stream.getTracks()) item.stop();
  }
}
