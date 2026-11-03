import { CSSProperties, ReactNode } from "react";
import { INK } from "../lib/colors";
import { BUTTON_SIZE_SM, SANS, SANS_TYPE, SANS_UI } from "../lib/theme";

interface PillButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** light = gray text on light pages (default); dark = white text on dark pages; outline = bordered secondary;
   * ghost = the light label alone, smaller and quieter, no fill */
  variant?: "light" | "dark" | "outline" | "ghost";
  /** trailing glyph, e.g. "›" or "✦" */
  trailing?: string;
  /** leading node, e.g. a stop-icon SVG */
  icon?: ReactNode;
  /** positioning only — visuals live here */
  style?: CSSProperties;
  className?: string;
  /** Instructional dialogs keep sentence case; the rest of the chrome stays lowercase. */
  transform?: "lowercase" | "none";
}

const DIMMED = "rgba(140, 140, 140, 0.5)";
/** The label is the action ink; the fill stays pale with a hairline edge, so
 * the pill reads as a control on the water without a grey-on-grey blob. */
const LIGHT_TEXT = INK.action;
const OUTLINE_BORDER = "1px solid rgba(90, 90, 99, 0.28)";
const LIGHT_BORDER = "1px solid rgba(90, 90, 99, 0.14)";
const LIGHT_FILL = "rgba(123, 123, 135, 0.1)";
const LIGHT_FILL_DISABLED = "rgba(123, 123, 135, 0.06)";
/** The ghost is the underwater steps' continue: no fill, but full ink at the UI size. */
const GHOST_SIZE = `${SANS_TYPE.ui.fontSize}px`;
/** The handling slider's rule strength (no longer the ghost label's). */
export const GHOST_OPACITY = 0.62;

/** The trailing "›" drawn as the same thin arrow the panes and phone use. */
function TrailingArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: "block", flex: "none" }}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function PillButton({
  label,
  onClick,
  disabled = false,
  variant = "light",
  trailing,
  icon,
  style,
  className,
  transform = "lowercase",
}: PillButtonProps) {
  const isDark = variant === "dark";
  const isOutline = variant === "outline";
  const isGhost = variant === "ghost";
  const textColor = isDark
    ? "white"
    : disabled
      ? DIMMED
      : LIGHT_TEXT;
  const fontSize = isGhost ? GHOST_SIZE : BUTTON_SIZE_SM;

  const background = isOutline || isGhost
    ? "transparent"
    : isDark
      ? "rgba(218, 218, 218, 0.25)"
      : disabled
        ? LIGHT_FILL_DISABLED
        : LIGHT_FILL;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className ? `nijimu-press ${className}` : "nijimu-press"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: isGhost ? "12px 16px" : "12px 26px",
        borderRadius: 100,
        border: isOutline ? OUTLINE_BORDER : isGhost || isDark ? "none" : LIGHT_BORDER,
        color: textColor,
        background,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        transition: "opacity 0.2s ease, border-color 0.2s ease, color 0.2s ease, scale 160ms cubic-bezier(0.23, 1, 0.32, 1)",
        ...style,
      }}
    >
      {icon}
      <span
        style={{
          fontFamily: isDark ? SANS_UI : SANS,
          fontSize,
          // the pill is the screen's way on: it leads at 500
          fontWeight: isDark || isGhost ? 400 : 500,
          lineHeight: 1.5,
          letterSpacing: SANS_TYPE.ui.letterSpacing,
          color: textColor,
          textShadow: isDark ? "0px 4px 100px black" : "none",
          textTransform: transform,
        }}
      >
        {label}
      </span>
      {trailing === "›" ? <TrailingArrow /> : trailing && (
        <span style={{ fontFamily: SANS, fontSize, lineHeight: 0, color: textColor }}>
          {trailing}
        </span>
      )}
    </button>
  );
}
