import { CSSProperties, ReactNode } from "react";
import { BUTTON_SIZE_SM, SANS, SANS_UI } from "../lib/theme";
import { useCompact } from "../hooks/useCompact";
import { GLASS_BLUR, GLASS_FILL } from "./GlassPane";
import { PaperFinish } from "./PaperFinish";

interface PillButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** light = gray text on light pages (default); dark = white text on dark pages; outline = bordered secondary */
  variant?: "light" | "dark" | "outline";
  /** trailing glyph, e.g. "›" or "✦" */
  trailing?: string;
  /** leading node, e.g. a stop-icon SVG */
  icon?: ReactNode;
  /** positioning only — visuals live here */
  style?: CSSProperties;
  className?: string;
  /** Instructional dialogs keep sentence case; the rest of the chrome stays lowercase. */
  transform?: "lowercase" | "none";
  /** "glass": the dialogs' frosted fill, blur and paper finish (GlassPane) in place of the flat tint. */
  surface?: "fill" | "glass";
  /** A blend mode for the label and trailing glyph only (the fill keeps normal blending). */
  textBlend?: CSSProperties["mixBlendMode"];
  /** Wears the disabled look (and is announced as unavailable) but still takes a press, for a button
      whose press explains why it is not ready rather than doing nothing. */
  looksDisabled?: boolean;
}

const DIMMED = "rgba(140, 140, 140, 0.5)";
/** Shared chrome — cool gray to match light-page UI */
const LIGHT_TEXT = "#7b7b87";
const OUTLINE_BORDER = "1px solid rgba(123, 123, 135, 0.28)";
const LIGHT_FILL = "rgba(123, 123, 135, 0.16)";
const LIGHT_FILL_DISABLED = "rgba(123, 123, 135, 0.08)";
const isOutlineVariant = (v: PillButtonProps["variant"]) => v === "outline";
/** Over the glass's finish. */
const ABOVE: CSSProperties = { position: "relative", zIndex: 2 };

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
  surface = "fill",
  textBlend,
  looksDisabled = false,
}: PillButtonProps) {
  const dim = disabled || looksDisabled;
  const compact = useCompact();
  const glass = surface === "glass" && !isOutlineVariant(variant);
  const isDark = variant === "dark";
  const isOutline = variant === "outline";
  const textColor = isDark
    ? "white"
    : dim
      ? DIMMED
      : LIGHT_TEXT;

  const background = glass
    ? compact ? GLASS_FILL.compact : GLASS_FILL.wide
    : isOutline
    ? "transparent"
    : isDark
      ? "rgba(218, 218, 218, 0.25)"
      : dim
        ? LIGHT_FILL_DISABLED
        : LIGHT_FILL;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-disabled={looksDisabled || undefined}
      className={className ? `nijimu-press ${className}` : "nijimu-press"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "12px 28px",
        borderRadius: 100,
        border: isOutline ? OUTLINE_BORDER : "none",
        background,
        ...(glass ? {
          position: "relative",
          overflow: "hidden",
          isolation: "isolate",
          backdropFilter: compact ? GLASS_BLUR.compact : GLASS_BLUR.wide,
          WebkitBackdropFilter: compact ? GLASS_BLUR.compact : GLASS_BLUR.wide,
          opacity: dim ? 0.6 : undefined,
        } : {}),
        cursor: disabled ? "not-allowed" : looksDisabled ? "default" : "pointer",
        whiteSpace: "nowrap",
        transition: "opacity 0.2s ease, border-color 0.2s ease, color 0.2s ease, background-color 0.3s ease, scale 160ms cubic-bezier(0.23, 1, 0.32, 1)",
        ...style,
      }}
    >
      {glass && <PaperFinish fine zIndex={1} radius="inherit" />}
      {icon}
      <span
        style={{
          ...(glass ? ABOVE : {}),
          mixBlendMode: textBlend,
          fontFamily: isDark ? SANS_UI : SANS,
          fontSize: BUTTON_SIZE_SM,
          fontWeight: isDark ? 300 : 400,
          lineHeight: 1.5,
          letterSpacing: 0,
          color: textColor,
          textShadow: isDark ? "0px 4px 100px black" : "none",
          textTransform: transform,
        }}
      >
        {label}
      </span>
      {trailing && (
        <span
          style={{
            ...(glass ? ABOVE : {}),
            mixBlendMode: textBlend,
            fontFamily: SANS_UI,
            fontSize: BUTTON_SIZE_SM,
            lineHeight: 0,
            letterSpacing: 0,
            color: textColor,
            fontVariationSettings: "'wdth' 100",
          }}
        >
          {trailing}
        </span>
      )}
    </button>
  );
}
