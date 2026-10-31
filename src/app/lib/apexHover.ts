import { useSyncExternalStore } from "react";

/** Whether the pointer rests on the body of the vessel at the gallery's apex. */
let over = false;
const listeners = new Set<() => void>();

export function setApexHover(next: boolean) {
  if (next === over) return;
  over = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useApexHover() {
  return useSyncExternalStore(subscribe, () => over, () => false);
}
