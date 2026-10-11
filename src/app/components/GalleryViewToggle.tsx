import { useState } from "react";
import { CHROME_GRAY } from "../lib/colors";
import { HEADER_ICON_LABEL_PAD, HeaderIconLabel } from "./HeaderIconLabel";

/** Top-right switch between the G-key carousel and the card grid.
 *  Sits left of the profile / music chrome (see --chrome-r* in responsive.css).
 *  The dedicated /memory carousel uses `icon="plus"` to create a memory. */
export function GalleryViewToggle({
  view,
  onToggle,
  visible = true,
  enterAnimation,
  icon = "view",
  label,
}: {
  view: "carousel" | "grid";
  onToggle: () => void;
  visible?: boolean;
  /** CSS animation for the button's own arrival. On the button itself — a
      filter on a wrapper would become the containing block of this fixed
      element and pull it out of the corner. */
  enterAnimation?: string;
  icon?: "view" | "plus";
  label?: string;
}) {
  const [nameShown, setNameShown] = useState(false);
  if (!visible) return null;

  const toGrid = view === "carousel";
  const title = label ?? (icon === "plus"
    ? "create a new memory"
    : toGrid ? "grid view" : "gallery view");
  const name = icon === "plus" ? "create" : title.split(" ")[0]?.toLowerCase() || "gallery";

  return (
    <button
      type="button"
      aria-label={title}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onMouseEnter={() => setNameShown(true)}
      onMouseLeave={() => setNameShown(false)}
      onFocus={() => setNameShown(true)}
      onBlur={() => setNameShown(false)}
      style={{
        position: "fixed",
        top: "var(--chrome-top)",
        right: "var(--chrome-r2)",
        zIndex: 99999,
        boxSizing: "border-box",
        width: "var(--chrome-icon)",
        height: 36 + HEADER_ICON_LABEL_PAD,
        padding: `0 0 ${HEADER_ICON_LABEL_PAD}px`,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.85,
        pointerEvents: "auto",
        animation: enterAnimation,
      }}
    >
      <HeaderIconLabel name={name} shown={nameShown} />
      {icon === "plus" ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="1.5" y="1.5" width="13" height="13" stroke={CHROME_GRAY} strokeWidth="1.2" />
          <path d="M8 4.75V11.25M4.75 8H11.25" stroke={CHROME_GRAY} strokeWidth="1.2" />
        </svg>
      ) : toGrid ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="1.5" y="1.5" width="5" height="5" stroke={CHROME_GRAY} strokeWidth="1.2" />
          <rect x="9.5" y="1.5" width="5" height="5" stroke={CHROME_GRAY} strokeWidth="1.2" />
          <rect x="1.5" y="9.5" width="5" height="5" stroke={CHROME_GRAY} strokeWidth="1.2" />
          <rect x="9.5" y="9.5" width="5" height="5" stroke={CHROME_GRAY} strokeWidth="1.2" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="3.2" stroke={CHROME_GRAY} strokeWidth="1.2" />
          <circle cx="2.6" cy="8" r="1.6" stroke={CHROME_GRAY} strokeWidth="1.2" />
          <circle cx="13.4" cy="8" r="1.6" stroke={CHROME_GRAY} strokeWidth="1.2" />
        </svg>
      )}
    </button>
  );
}
