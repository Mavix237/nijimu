/**
 * The choices at the foot of a floating pane: a Switzer label with a trailing mark.
 * Every option is set in the body's ink; the one the pane hopes for in
 * Medium, the way out in Regular. A dot mark opens from its centre on hover — filled with the given
 * colour for the hoped-for option, a bare ring for the way out. A way out may
 * wear an icon instead (`ring`): on hover it gives way to the same bare ring.
 */

import type { CSSProperties, ReactNode } from "react";
import { BUTTON_SIZE_SM, GALLERY_TRANSCRIPT, PANE_ACTION, SANS, SERIF, TITLE } from "../lib/theme";
import { PANE_INK } from "../lib/colors";

export const PANE_TITLE: CSSProperties = {
  ...TITLE,
  fontFamily: SANS,
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: PANE_INK.body,
  margin: 0,
  textAlign: "left",
  textWrap: "balance",
};

/** A pixel under `BODY_SIZE`. */
const PANE_BODY_SIZE = "clamp(13px, 3vw, 14px)";

/** Each sentence a line of its own where the pane breaks them; `pretty`
 * keeps a last word from standing alone. */
export const PANE_BODY: CSSProperties = {
  fontFamily: SERIF,
  // a step under the page's body copy: the pane's words are an aside
  fontSize: PANE_BODY_SIZE,
  fontWeight: 400,
  lineHeight: 1.45,
  color: PANE_INK.body,
  margin: 0,
  textAlign: "left",
  textWrap: "pretty",
};

/** The dot's open diameter; at rest it is drawn at `DOT_REST` of that. */
const DOT_PX = 16;
const DOT_REST = 5 / DOT_PX;
const MARK_PX = 18;
/** The ring's rest under an icon: the clock's face (r 9 of 24, through the
 * stroke's middle) against the ring's own 1.25 px border. */
const CLOCK_FACE = (MARK_PX * 18 / 24) / (DOT_PX - 1.25);

export function PaneOptions({ children, atFoot = false }: { children: ReactNode; atFoot?: boolean }) {
  return (
    <div className="nijimuPaneOptions" data-at-foot={atFoot}>
      {children}
      <style>{PANE_OPTION_CSS}</style>
    </div>
  );
}

export function PaneOption({
  label,
  onClick,
  primary = false,
  disabled = false,
  mark = "dot",
  dotColor,
  ring = false,
  ariaLabel,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  /** "dot", or an icon drawn in the label's colour. */
  mark?: "dot" | ReactNode;
  /** The hoped-for option's dot. The way out always opens into a grey ring. */
  dotColor?: string;
  /** An icon mark on a way out that opens into the grey ring on hover. */
  ring?: boolean;
  ariaLabel?: string;
}) {
  const color = PANE_INK.primary;
  const iconRing = ring && !primary && mark !== "dot";
  return (
    <button
      type="button"
      className="nijimuPaneOption"
      data-primary={primary}
      data-mark={mark === "dot" ? "dot" : iconRing ? "icon-ring" : "icon"}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{ color }}
    >
      <span className="nijimuPaneLabel">{label}</span>
      <span className="nijimuPaneMark" aria-hidden>
        {mark === "dot" ? (
          <>
            <span className="nijimuPaneDot" style={{ background: primary ? dotColor ?? PANE_INK.primary : PANE_INK.ring }} />
            {!primary && <span className="nijimuPaneRing" />}
          </>
        ) : (
          <>
            <span className="nijimuPaneIcon">{mark}</span>
            {iconRing && <span className="nijimuPaneRing" />}
          </>
        )}
      </span>
    </button>
  );
}

function Icon({ children, size = MARK_PX }: { children: ReactNode; size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: "block" }}>
      {children}
    </svg>
  );
}

export function MicIcon() {
  return (
    <Icon>
      <path d="M12 19v3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <rect x="9" y="2" width="6" height="13" rx="3" />
    </Icon>
  );
}

export function CameraIcon() {
  return (
    <Icon>
      <path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" />
      <circle cx="12" cy="13" r="3" />
    </Icon>
  );
}

/** Phosphor's clock, drawn in this set's stroke. */
export function ClockIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.75V12h5.25" />
    </Icon>
  );
}

export function DownloadIcon() {
  return (
    <Icon>
      <path d="M12 15V3" />
      <path d="m7 10 5 5 5-5" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </Icon>
  );
}

export function ArrowIcon() {
  return (
    <span className="nijimuPaneArrow" style={{ display: "block" }}>
      <Icon>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </Icon>
    </span>
  );
}

export function HandIcon({ size = "1em" }: { size?: number | string }) {
  return (
    <Icon size={size}>
      <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </Icon>
  );
}

const OPEN = "cubic-bezier(0.22, 1, 0.36, 1)";

const PANE_OPTION_CSS = `
.nijimuPaneOptions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  flex-shrink: 0;
  gap: 0;
}
.nijimuPaneOptions[data-at-foot="true"] { margin-top: auto; }
.nijimuPaneOption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0;
  padding: ${PANE_ACTION.paddingY}px 0;
  min-height: 44px;
  width: 100%;
  border: none;
  border-block: 1px solid color-mix(in srgb, ${GALLERY_TRANSCRIPT.color} ${PANE_ACTION.borderOpacity}%, transparent);
  border-radius: 0;
  background: transparent;
  font-family: ${SANS};
  font-size: ${BUTTON_SIZE_SM};
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: 0;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color 240ms ease, opacity 200ms ease;
}
.nijimuPaneOption + .nijimuPaneOption { border-top: 0; }
.nijimuPaneOption:last-of-type { border-bottom: 0; }
.nijimuPaneOption[data-primary="true"] { font-weight: 500; }
.nijimuPaneOption:disabled { cursor: default; opacity: 0.5; }
.nijimuPaneOption:focus { outline: none; }
.nijimuPaneOption:focus-visible { box-shadow: 0 0 0 1px rgba(123, 123, 135, 0.35); }
.nijimuPaneMark {
  position: relative;
  flex: none;
  width: ${MARK_PX}px;
  height: ${MARK_PX}px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nijimuPaneDot, .nijimuPaneRing {
  position: absolute;
  left: 50%;
  top: 50%;
  width: ${DOT_PX}px;
  height: ${DOT_PX}px;
  margin: ${-DOT_PX / 2}px 0 0 ${-DOT_PX / 2}px;
  border-radius: 50%;
  box-sizing: border-box;
  transform: scale(${DOT_REST});
  transition: transform 520ms ${OPEN}, opacity 360ms ease;
}
.nijimuPaneRing {
  border: 1.25px solid ${PANE_INK.ring};
  opacity: 0;
}
.nijimuPaneIcon, .nijimuPaneArrow {
  display: block;
  transition: transform 420ms ${OPEN}, opacity 280ms ease;
}
.nijimuPaneOption[data-mark="icon-ring"] .nijimuPaneRing { transform: scale(${CLOCK_FACE}); }
.nijimuPaneLabel { transition: transform 420ms ${OPEN}; }

@media (hover: hover) {
  .nijimuPaneOption:not(:disabled):hover .nijimuPaneDot { transform: scale(1); }
  .nijimuPaneOption[data-primary="false"]:not(:disabled):hover .nijimuPaneDot { transform: scale(${DOT_REST * 0.6}); opacity: 0; }
  .nijimuPaneOption[data-primary="false"]:not(:disabled):hover .nijimuPaneRing { transform: scale(1); opacity: 1; }
  .nijimuPaneOption:not(:disabled):hover .nijimuPaneIcon { transform: scale(1.08); }
  .nijimuPaneOption:not(:disabled):hover .nijimuPaneArrow { transform: translateX(3px); }
  .nijimuPaneOption[data-mark="icon"]:not(:disabled):hover .nijimuPaneLabel { transform: translateX(1px); }
  .nijimuPaneOption[data-mark="icon-ring"]:not(:disabled):hover .nijimuPaneIcon { transform: scale(0.9); opacity: 0; }
}
.nijimuPaneOption[data-mark="icon-ring"]:focus-visible .nijimuPaneIcon { transform: scale(0.9); opacity: 0; }
.nijimuPaneOption:focus-visible .nijimuPaneDot { transform: scale(1); }
.nijimuPaneOption[data-primary="false"]:focus-visible .nijimuPaneDot { transform: scale(${DOT_REST * 0.6}); opacity: 0; }
.nijimuPaneOption[data-primary="false"]:focus-visible .nijimuPaneRing { transform: scale(1); opacity: 1; }

.nijimuPaneOption:not(:disabled):active .nijimuPaneDot,
.nijimuPaneOption:not(:disabled):active .nijimuPaneRing {
  transform: scale(0.82);
  transition-duration: 160ms;
}
.nijimuPaneOption[data-primary="false"]:not(:disabled):active .nijimuPaneDot { opacity: 0; }
.nijimuPaneOption[data-primary="false"]:not(:disabled):active .nijimuPaneRing { opacity: 1; }
.nijimuPaneOption:not(:disabled):active .nijimuPaneIcon { transform: scale(0.92); transition-duration: 140ms; }
.nijimuPaneOption[data-mark="icon-ring"]:not(:disabled):active .nijimuPaneIcon { opacity: 0; }
.nijimuPaneOption:not(:disabled):active { opacity: 0.72; transition-duration: 100ms; }

@media (prefers-reduced-motion: reduce) {
  .nijimuPaneDot, .nijimuPaneRing, .nijimuPaneIcon, .nijimuPaneArrow, .nijimuPaneLabel {
    transition-duration: 160ms;
  }
}
`;
