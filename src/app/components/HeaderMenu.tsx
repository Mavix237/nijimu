import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CHROME_GRAY } from "../lib/colors";
import { SANS } from "../lib/theme";

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
export const HEADER_MENU_ORDER = { create: 0, view: 1, field: 2, music: 3 } as const;

const ROW_ICON = 16;

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
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: 0,
        // the dock's row, with room for a fingertip
        padding: "11px 12px",
        border: "none",
        background: "transparent",
        color: CHROME_GRAY,
        cursor: "pointer",
        fontFamily: SANS,
        fontSize: 12,
        letterSpacing: "0.04em",
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

const TURN_MS = 320;

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
        {/* turns a quarter anticlockwise as the list opens, and back as it folds */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
          style={{
            transform: open ? "rotate(-90deg)" : "rotate(0deg)",
            transition: reduced ? "none" : `transform ${TURN_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          }}
        >
          <path d="M2 4.25H14M2 8H14M2 11.75H14" stroke={CHROME_GRAY} strokeWidth="1.2" strokeLinecap="round" />
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
          padding: 4,
          // no panel of its own: the names sit on the page, as the editor dock's did
          background: "transparent",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-6px)",
          transformOrigin: "top right",
          transition: reduced ? "none" : `opacity ${TURN_MS - 60}ms ease, transform ${TURN_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          pointerEvents: open ? "auto" : "none",
        }}
      />
    </>
  );
}
