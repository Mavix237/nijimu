import { useEffect } from "react";
import { toggleSerifPreview } from "../lib/serifPreview";

/** TEMPORARY — the T key switches every serif between Rowan and EB Garamond (a
    reload). No icon: a bare press, never while typing or with a modifier held. */
export function SerifPreviewToggle() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "t" && e.key !== "T") return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return;
      toggleSerifPreview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
