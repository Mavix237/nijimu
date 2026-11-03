/** Whether the DialKit panels open expanded. By default every panel starts
    folded (a tap on a panel's header opens it), on every screen.
    `?dials=open` opens them expanded instead and `?dials=closed` folds them;
    either is kept on this device (localStorage `nijimu.dials`), and
    `?dials=auto` forgets it. Decided once at load. */
const KEY = "nijimu.dials";

function readDialsPick(): string | null {
  let pick: string | null = null;
  try {
    pick = new URLSearchParams(window.location.search).get("dials");
  } catch { /* no URL */ }
  try {
    if (pick === "open" || pick === "closed") localStorage.setItem(KEY, pick);
    else if (pick === "auto") localStorage.removeItem(KEY);
    else pick = localStorage.getItem(KEY);
  } catch { /* storage blocked */ }
  return pick;
}

const PICK = readDialsPick();
export const DIALS_OPEN = PICK === "open";
/** The studio (/studio) is a page of panels: they open expanded there unless `?dials=closed` was chosen. */
export const STUDIO_DIALS_OPEN = PICK !== "closed";
