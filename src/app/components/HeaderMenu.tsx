import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CHROME_GRAY, INK } from "../lib/colors";
import { SANS, SANS_TYPE } from "../lib/theme";

/*
 * On a phone the header's corner icons fold into one: a burger in the
 * corner that opens them as a short list, each an icon and its name — the
 * way the landing's editor dock drew its entries. The controls stay where
 * they are written (App, the gallery's plus, the field's toggle); on a phone
 * each renders itself as a row in this list (`HeaderMenuRow`) instead of as
 * its own corner icon. Without a list (wider screens, the labs) they draw as
 * before.
 */

export interface HeaderMenuValue {
  /** Where the rows go; null when the header is not folded. */
  list: HTMLElement | null;
  close: () => void;
}

export const HeaderMenuContext = createContext<HeaderMenuValue>({ list: null, close: () => {} });

export function useHeaderMenu(): HeaderMenuValue {
  return useContext(HeaderMenuContext);
}

/** Rows top to bottom: what the page offers first, the sound last. */
export const HEADER_MENU_ORDER = { create: 0, view: 1, field: 2, library: 3, music: 4 } as const;

const ROW_ICON = 16;

/** The landing's paper grain as a repeating tile: one grain per device pixel,
    at the alpha the landing paints its own (BlobScene's grain canvas). */
let grainTile: string | null = null;
function paperGrain(): string {
  if (grainTile) return grainTile;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return (grainTile = "none");
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 42;
  }
  ctx.putImageData(img, 0, 0);
  return (grainTile = `url(${canvas.toDataURL()})`);
}

/** One header control as a row of the folded menu. Renders nothing when the header is not folded. */
export function HeaderMenuRow({ icon, label, ariaLabel, expanded, order, onClick }: {
  icon: ReactNode;
  label: string;
  ariaLabel?: string;
  expanded?: boolean;
  order: number;
  onClick: () => void;
}) {
  const { list, close } = useHeaderMenu();
  if (!list) return null;
  return createPortal(
    <button
      type="button"
      role="menuitem"
      aria-label={ariaLabel}
      aria-expanded={expanded}
      onClick={(event) => {
        event.stopPropagation();
        close();
        onClick();
      }}
      style={{
        order,
        position: "relative",
        zIndex: 1,
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: 0,
        // the dock's row, with room for a fingertip
        padding: "11px 12px",
        border: "none",
        background: "transparent",
        // a row is an action, not a label: the action ink at the UI size, barely tracked
        color: INK.action,
        cursor: "pointer",
        fontFamily: SANS,
        ...SANS_TYPE.ui,
        lineHeight: 1,
        textTransform: "lowercase",
        whiteSpace: "nowrap",
        textAlign: "left",
      }}
    >
      <span aria-hidden style={{ width: ROW_ICON, height: ROW_ICON, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </span>
      {label}
    </button>,
    list,
  );
}

/** The burger folding into a cross. The list opens on a strong ease-out and folds faster than it opened. */
const TURN_MS = 240;
const OPEN_MS = 200;
const CLOSE_MS = 150;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

/** The burger and the list it opens. The list stays mounted (closed, inert) so the rows always have somewhere to go. */
export function HeaderMenu({ open, onOpenChange, listRef, hidden = false }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listRef: (el: HTMLDivElement | null) => void;
  /** Faded out with the rest of the chrome while the scene leaves for the landing. */
  hidden?: boolean;
}) {
  const burgerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // a press anywhere else, or Escape, folds it again
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || burgerRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onOpenChange(false);
      burgerRef.current?.focus();
    };
    document.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", key);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <button
        ref={burgerRef}
        type="button"
        aria-label={open ? "close menu" : "menu"}
        aria-expanded={open}
        aria-controls="header-menu"
        aria-haspopup="menu"
        className="nijimu-press-icon"
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
        style={{
          position: "fixed",
          top: "var(--chrome-top)",
          right: "var(--chrome-r0)",
          zIndex: 99999,
          width: 36,
          height: 36,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: hidden ? 0 : 0.85,
          transition: "opacity 300ms ease",
          pointerEvents: hidden ? "none" : "auto",
        }}
      >
        {/* the outer lines fold into a cross as the list opens; the middle one lets go */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
          // the press (motion.css) is a scale on the glyph
          style={{ transition: `scale 160ms ${EASE_OUT}` }}
        >
          {([
            ["M2 4.25H14", "rotate(45deg) translateY(3.75px)"],
            ["M2 8H14", "scaleX(0.3)"],
            ["M2 11.75H14", "rotate(-45deg) translateY(-3.75px)"],
          ] as const).map(([d, folded], i) => (
            <path key={d} d={d} stroke={CHROME_GRAY} strokeWidth="1.2" strokeLinecap="round"
              style={{
                transformOrigin: "8px 8px",
                transform: open ? folded : "none",
                opacity: open && i === 1 ? 0 : 1,
                transition: reduced ? "none" : `transform ${TURN_MS}ms ${EASE_OUT}, opacity ${TURN_MS / 2}ms ease`,
              }} />
          ))}
        </svg>
      </button>

      <div
        ref={(el) => {
          panelRef.current = el;
          listRef(el);
        }}
        id="header-menu"
        role="menu"
        aria-label="menu"
        inert={!open}
        style={{
          position: "fixed",
          top: "calc(var(--chrome-top) + 42px)",
          right: "calc(var(--chrome-r0) + 2px)",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          padding: "2px 4px",
          borderRadius: 12,
          // lifted a breath off the page
          boxShadow: "0 8px 28px rgba(70, 70, 84, 0.1)",
          // the page itself, blurred, under a paper tint: within a few levels of
          // each ground it opens over (the landing's #e4e4e6, the gallery's water
          // paper ≈ rgb(235,234,232), the pond's pale sky), and what lies beneath —
          // the tip, a vessel — is muted rather than smudged grey. The grain over
          // it is the landing's.
          backgroundColor: "rgba(234, 234, 234, 0.6)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          opacity: open ? 1 : 0,
          // reduced motion keeps the fade and drops the travel
          transform: open || reduced ? "none" : "translateY(-4px) scale(0.97)",
          transformOrigin: "top right",
          transition: open
            ? `opacity ${OPEN_MS}ms ease, transform ${OPEN_MS}ms ${EASE_OUT}`
            : `opacity ${CLOSE_MS}ms ease, transform ${CLOSE_MS}ms ease`,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div aria-hidden style={{
          position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", zIndex: 0,
          backgroundImage: paperGrain(),
          backgroundSize: `${128 / Math.min(window.devicePixelRatio || 1, 3)}px`,
          mixBlendMode: "overlay",
          opacity: 0.48,
        }} />
      </div>
    </>
  );
}
