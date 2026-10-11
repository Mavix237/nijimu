import { CHROME_GRAY } from "../lib/colors";
import { SANS } from "../lib/theme";

/** Space under a header icon. Hovering there shows the control's name. */
export const HEADER_ICON_LABEL_PAD = 28;

/** Quiet name under one of the top-right header icons. */
export function HeaderIconLabel({ name, shown }: { name: string; shown: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        top: 40,
        left: "50%",
        transform: "translateX(-50%)",
        fontFamily: SANS,
        fontSize: 12,
        fontWeight: 400,
        letterSpacing: "0.04em",
        lineHeight: 1,
        color: CHROME_GRAY,
        whiteSpace: "nowrap",
        textTransform: "lowercase",
        opacity: shown ? 1 : 0,
        transition: "opacity 180ms ease",
        pointerEvents: "none",
      }}
    >
      {name}
    </span>
  );
}
