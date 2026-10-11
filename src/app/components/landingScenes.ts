import { lazy } from "react";

/*
 * The 3D world behind the landing — the gallery, the pond, the descent — and
 * three.js with it, loaded as its own chunks rather than with the page. The
 * landing itself is plain DOM, so a phone paints it without first parsing
 * the scenes. LandingPage asks for them as soon as the landing is idle, and
 * again on Enter; a direct visit to a scene route waits for them under a
 * Suspense boundary.
 */

const carousel = () => import("./MemoryCarouselPage");
const pond = () => import("./MemoryPondPage");
const descent = () => import("../lab/DescentPrototype");
const vesselGallery = () => import("../lab/VesselGalleryPreview");

export const MemoryCarouselPage = lazy(() => carousel().then((m) => ({ default: m.MemoryCarouselPage })));
export const MemoryPondPage = lazy(() => pond().then((m) => ({ default: m.MemoryPondPage })));
export const DescentFlow = lazy(() => descent().then((m) => ({ default: m.DescentFlow })));
export const LiveVesselGallery = lazy(() => vesselGallery().then((m) => ({ default: m.LiveVesselGallery })));

let preloaded = false;
/** Starts fetching every scene; repeat calls do nothing. */
export function preloadLandingScenes() {
  if (preloaded) return;
  preloaded = true;
  void Promise.all([carousel(), pond(), descent(), vesselGallery()]).catch(() => { preloaded = false; });
}

/** Preload once the landing has painted and the page is idle. */
export function preloadLandingScenesWhenIdle(): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(preloadLandingScenes, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(preloadLandingScenes, 600);
  return () => window.clearTimeout(id);
}
