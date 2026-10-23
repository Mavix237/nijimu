/* TEMPORARY — a preview of every serif set in EB Garamond, to judge it
   against Rowan before choosing. The font stacks in theme.ts are read once,
   at load, so the switch is kept in localStorage and takes effect on reload
   (`?serif=garamond` / `?serif=rowan` sets it from a link). Remove this file,
   SerifPreviewToggle and the "EB Garamond Preview" faces once decided. */

const KEY = "nijimu.serifPreview";

function readSerifPreview(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const asked = new URLSearchParams(window.location.search).get("serif");
    if (asked === "garamond" || asked === "rowan") {
      window.localStorage.setItem(KEY, asked);
      return asked === "garamond";
    }
    return window.localStorage.getItem(KEY) === "garamond";
  } catch {
    return false;
  }
}

/** True when this visit sets every serif in EB Garamond. */
export const SERIF_GARAMOND = readSerifPreview();

/** Flip the preview and reload so every stack is read afresh. */
export function toggleSerifPreview() {
  try {
    window.localStorage.setItem(KEY, SERIF_GARAMOND ? "rowan" : "garamond");
  } catch {
    // storage refused: the link form still works
  }
  // a ?serif= already on the URL would win over storage: turn it too, keeping
  // the history entry's state (the create flow's draft) through the reload
  const url = new URL(window.location.href);
  if (url.searchParams.has("serif")) {
    url.searchParams.set("serif", SERIF_GARAMOND ? "rowan" : "garamond");
    window.history.replaceState(window.history.state, "", url);
  }
  window.location.reload();
}
