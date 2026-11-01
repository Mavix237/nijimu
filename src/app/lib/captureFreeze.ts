/**
 * Holds the current frame still while a snapshot is being read.
 * Clocks check this and skip their step; nothing is rewound or rebuilt.
 */

let depth = 0;

export function captureFrozen(): boolean {
  return depth > 0;
}

export function freezeCapture(): () => void {
  depth += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    depth = Math.max(0, depth - 1);
  };
}
