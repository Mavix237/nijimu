import { CSSProperties } from "react";
import { BUTTON_SIZE_SM, SANS } from "../lib/theme";

interface TextButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  trailing?: string;
  style?: CSSProperties;
}

/** Bare label control — Switzer, no tracking, no chrome. */
export function TextButton({
  label,
  onClick,
  disabled = false,
  trailing,
  style,
}: TextButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="nijimu-text-button"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: "none",
        background: "transparent",
        cursor: disabled ? "default" : "pointer",
        padding: 0,
        fontFamily: SANS,
        fontSize: BUTTON_SIZE_SM,
        fontWeight: 400,
        color: "#7b7b87",
        letterSpacing: 0,
        whiteSpace: "nowrap",
        // left unset when enabled so the hover and press can move it
        opacity: disabled ? 0.4 : undefined,
        ...style,
      }}
    >
      {label}
      {trailing && (
        <span aria-hidden style={{ letterSpacing: "-0.12em", lineHeight: 1 }}>
          {trailing}
        </span>
      )}
    </button>
  );
}
