import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CHROME_GRAY } from "../lib/colors";
import { capturePage } from "../lib/renderExport";
import { SANS } from "../lib/theme";
import { HEADER_ICON_LABEL_PAD, HeaderIconLabel } from "./HeaderIconLabel";
import { HEADER_MENU_ORDER, useHeaderMenu, useRenderSeat } from "./HeaderMenu";

/**
 * The corner render menu. It photographs the browser's current picture:
 * the page as it is, or the same picture without the words and controls.
 */
export function RenderMenu({ hidden = false }: { hidden?: boolean }) {
  const { list, close } = useHeaderMenu();
  const seat = useRenderSeat();
  const [open, setOpen] = useState(false);
  const [nameShown, setNameShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [withUi, setWithUi] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target instanceof Element && target.closest("[data-render-menu]")) return;
      setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  const save = () => {
    if (busy) return;
    setBusy(true);
    setNote("capturing…");
    void capturePage({ includeUi: withUi }).then((result) => {
      setNote(`saved · ${result.width}×${result.height}`);
    }).catch((error: unknown) => {
      setNote(error instanceof Error ? error.message : "couldn't capture");
    }).finally(() => setBusy(false));
  };

  const glyph = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.25 5.25V2.75H4.75" stroke={CHROME_GRAY} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.25 2.75H13.75V5.25" stroke={CHROME_GRAY} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.75 10.75V13.25H11.25" stroke={CHROME_GRAY} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.75 13.25H2.25V10.75" stroke={CHROME_GRAY} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const toggle = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    setNote(null);
    setOpen((value) => {
      if (!value) close();
      return !value;
    });
  };

  const panel = open ? createPortal(
    <div data-render-menu role="dialog" aria-label="render" style={panelStyle(seat)}>
      <div style={choiceRow}>
        <span style={rowLabel}>contents</span>
        <span style={choices}>
          <Choice pressed={!withUi} disabled={busy} onClick={() => setWithUi(false)}>picture</Choice>
          <Choice pressed={withUi} disabled={busy} onClick={() => setWithUi(true)}>with ui</Choice>
        </span>
      </div>
      <button type="button" disabled={busy} onClick={save} style={exportButton}>
        {busy ? "capturing…" : withUi ? "export with ui" : "export picture"}
      </button>
      {note && <span style={noteStyle}>{note}</span>}
    </div>,
    document.body,
  ) : null;

  if (list) {
    return (
      <>
        {createPortal(
          <div data-render-menu style={{ display: "contents" }}>
            <button
              type="button"
              role="menuitem"
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={toggle}
              style={rowStyle(HEADER_MENU_ORDER.render)}
            >
              <span aria-hidden style={iconBox}>{glyph}</span>
              render
            </button>
          </div>,
          list,
        )}
        {panel}
      </>
    );
  }

  return (
    <div data-render-menu style={{ display: "contents" }}>
      <button
        type="button"
        aria-label="render"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="nijimu-press-icon"
        onClick={toggle}
        onMouseEnter={() => setNameShown(true)}
        onMouseLeave={() => setNameShown(false)}
        onFocus={() => setNameShown(true)}
        onBlur={() => setNameShown(false)}
        style={{
          position: "fixed",
          top: "var(--chrome-top)",
          right: `var(--chrome-${seat})`,
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
          opacity: hidden ? 0 : 0.85,
          pointerEvents: hidden ? "none" : "auto",
          transition: "opacity 300ms ease",
        }}
      >
        <HeaderIconLabel name="render" shown={nameShown && !open} />
        {glyph}
      </button>
      {panel}
    </div>
  );
}

function Choice({ pressed, disabled, onClick, children }: {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-pressed={pressed} disabled={disabled} onClick={onClick} style={{
      ...choice,
      fontWeight: pressed ? 500 : 400,
      opacity: pressed ? 1 : 0.55,
    }}>
      {children}
    </button>
  );
}

const ink = {
  color: CHROME_GRAY,
  fontFamily: SANS,
  fontSize: 11,
  letterSpacing: "0.04em",
  lineHeight: 1.2,
  textTransform: "lowercase" as const,
};

function panelStyle(seat: string): CSSProperties {
  return {
    position: "fixed",
    top: "calc(var(--chrome-top) + 40px)",
    right: `max(12px, var(--chrome-${seat}))`,
    zIndex: 100000,
    width: "min(292px, calc(100vw - 24px))",
    boxSizing: "border-box",
    padding: "10px 10px 8px",
    borderRadius: 12,
    backgroundColor: "rgba(234, 234, 234, 0.82)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    boxShadow: "0 8px 28px rgba(70, 70, 84, 0.1)",
    colorScheme: "light",
  };
}

const rowLabel: CSSProperties = {
  ...ink,
  flex: 1,
  textAlign: "left",
};

const choiceRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const choices: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: 2,
};

const choice: CSSProperties = {
  ...ink,
  margin: 0,
  padding: "3px 5px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
};

const exportButton: CSSProperties = {
  ...ink,
  margin: "4px 0 0",
  padding: "8px 2px",
  border: "none",
  borderTop: "1px solid rgba(126, 126, 134, 0.18)",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
};

const noteStyle: CSSProperties = {
  ...ink,
  display: "block",
  opacity: 0.7,
  padding: "2px 2px 0",
};

const iconBox: CSSProperties = {
  width: 16,
  height: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

function rowStyle(order: number): CSSProperties {
  return {
    ...ink,
    order,
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: 0,
    padding: "11px 12px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 12,
    textAlign: "left",
    whiteSpace: "nowrap",
  };
}
