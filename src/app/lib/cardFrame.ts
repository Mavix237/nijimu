/**
 * "Keep a copy" needs one frame of the vessel dressed for its card. Rendering it in a WebGL context of its
 * own was one context too many for a full visit (the hidden gallery's seats, the pond, the naming vessel):
 * the browser dropped the oldest — often the pond — and the water vanished behind the card. So the dialog
 * asks here (`askCardFrame`), and the naming vessel, hidden behind the card anyway, dresses as the card's
 * vessel for a moment in its own context and hands over its next complete frame (`giveCardFrame`). With no
 * vessel to answer (the asker's own wait), the dialog falls back to rendering one itself.
 */
type Taker = (frame: HTMLCanvasElement) => void;

let taker: Taker | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Ask for the card's frame; returns a way to withdraw the ask. */
export function askCardFrame(take: Taker): () => void {
  taker = take;
  notify();
  return () => {
    if (taker !== take) return;
    taker = null;
    notify();
  };
}

/** A frame is wanted (for useSyncExternalStore). */
export const cardFrameWanted = () => taker !== null;
export function onCardFrame(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The vessel's frame, dressed for the card: handed to whoever asked, once. */
export function giveCardFrame(frame: HTMLCanvasElement) {
  const take = taker;
  taker = null;
  notify();
  take?.(frame);
}
