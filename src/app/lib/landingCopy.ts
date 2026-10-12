import { useSyncExternalStore } from "react";

/*
 * Whether the landing shows its two lines of copy above the wordmark — the
 * description and "Enter". Toggled from the header beside the music; kept
 * for the visit (sessionStorage) so a reload shows the same version.
 */

const KEY = "nijimu.landing.copy";
const listeners = new Set<() => void>();

let shown = (() => {
  try {
    return sessionStorage.getItem(KEY) !== "hidden";
  } catch {
    return true;
  }
})();

export function setLandingCopyShown(next: boolean) {
  shown = next;
  try {
    sessionStorage.setItem(KEY, next ? "shown" : "hidden");
  } catch {
    /* the toggle still works for this page */
  }
  listeners.forEach((l) => l());
}

export function useLandingCopyShown(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => shown,
  );
}
