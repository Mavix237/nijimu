import { useEffect, useRef } from "react";
import { CHROME_GRAY } from "../lib/colors";
import { SANS } from "../lib/theme";

/** Space under a header icon. Hovering there shows the control's name. */
export const HEADER_ICON_LABEL_PAD = 28;

/** The first name waits a beat, so a pointer crossing the corner does not
    light it; once one has been read, its neighbours come at once. */
const FIRST_DELAY_MS = 300;
const WARM_MS = 500;
let namesShown = 0;
let warmUntil = 0;

/** Quiet name under one of the top-right header icons. */
export function HeaderIconLabel({ name, shown }: { name: string; shown: boolean }) {
  // taken once as the name is asked for, and held while it shows
  const instant = useRef(false);
  const was = useRef(false);
  if (shown && !was.current) instant.current = namesShown > 0 || performance.now() < warmUntil;
  was.current = shown;
  useEffect(() => {
    if (!shown) return;
    namesShown++;
    return () => {
      namesShown--;
      warmUntil = performance.now() + WARM_MS;
    };
  }, [shown]);
  return (
    <span
      aria-hidden
      className="header-icon-label"
      style={{
        position: "absolute",
        top: 40,
        left: "50%",
        transform: "translateX(-50%)",
        fontFamily: SANS,
        fontSize: 11,
        fontWeight: 400,
        letterSpacing: "0.04em",
        lineHeight: name.includes("\n") ? 1.15 : 1,
        color: CHROME_GRAY,
        whiteSpace: "pre",
        textAlign: "center",
        textTransform: "lowercase",
        opacity: shown ? 1 : 0,
        transition: !shown ? "opacity 150ms ease"
          : instant.current ? "none" : `opacity 180ms ease ${FIRST_DELAY_MS}ms`,
        pointerEvents: "none",
      }}
    >
      {name}
    </span>
  );
}
