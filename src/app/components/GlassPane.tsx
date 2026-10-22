import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LANDING_RETURN } from "../lib/landingReturn";
import { squirclePath } from "../lib/squircle";
import { useCompact } from "../hooks/useCompact";
import { PANE_ACTION, PANE_CONTENT_GAP } from "../lib/theme";

/** Paper grain — same recipe as SceneViewer / the dive gallery veil. */
const GRAIN_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch' result='noise'/%3E%3CfeColorMatrix in='noise' type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const LEAVE_MS = LANDING_RETURN.profileLeaveMs;
const CARD_EASE = "cubic-bezier(0.22, 0.8, 0.28, 1)";
const PANEL_RADIUS = 12;
const PANEL_SMOOTHING = 0.6;
const PANEL_WIDTH = 480;
const PANEL_MAX_HEIGHT = "min(82dvh, 620px)";
/** A pane for reading: most of a phone's height, still short of its edges. */
const PANEL_MAX_HEIGHT_TALL = "min(86dvh, 760px)";
/** Phones: how far the whole screen behind an open pane softens. */
const SCREEN_BLUR_PX = 10;

export function GlassPane({
  open,
  onClose,
  onExited,
  label,
  labelledBy,
  closeDisabled = false,
  align = "center",
  tall = false,
  children,
}: {
  open: boolean;
  /** Escape and a press outside the pane. */
  onClose: () => void;
  /** Fires after the leave animation finishes. */
  onExited?: () => void;
  label?: string;
  labelledBy?: string;
  closeDisabled?: boolean;
  /** Dialogs read from the left edge; the profile stays centred. */
  align?: "center" | "start";
  /** Taller, for reading a memory's whole text; it scrolls inside the pane. */
  tall?: boolean;
  children: ReactNode;
}) {
  const maxHeight = tall ? PANEL_MAX_HEIGHT_TALL : PANEL_MAX_HEIGHT;
  // a phone's pane covers most of the screen, the gallery's vessels included:
  // a deeper blur and a denser tint keep it reading as quiet frosted glass
  const compact = useCompact();
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
  /** One frame after mounting, so the pane transitions from its unseen state. */
  const [entered, setEntered] = useState(false);
  const paneState = leaving ? "out" : entered ? "in" : "from";
  const cardRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) return;
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setLeaving(false);
      setEntered(false);
      onExitedRef.current?.();
    }, LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted || entered) return;
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setEntered(true)); });
    return () => cancelAnimationFrame(frame);
  }, [mounted, entered]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) onCloseRef.current();
      if (e.key === "Tab") {
        const controls = Array.from(cardRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ) ?? []).filter(el => el.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { e.preventDefault(); cardRef.current?.focus(); }
        else if (!controls.includes(document.activeElement as HTMLElement)
          || (e.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeDisabled]);

  useEffect(() => {
    if (!open || !mounted) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    cardRef.current?.focus({ preventScroll: true });
    return () => restoreFocusTo.current?.focus?.({ preventScroll: true });
  }, [open, mounted]);

  // The smoothed corner is a clip path; it follows the pane's own size.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!mounted || !card) return;
    const fit = () => {
      const { offsetWidth: w, offsetHeight: h } = card;
      if (w && h) card.style.clipPath = `path("${squirclePath(w, h, PANEL_RADIUS, PANEL_SMOOTHING)}")`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(card);
    return () => observer.disconnect();
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      className="nijimuProfileScrim"
      data-state={paneState}
      onClick={() => { if (!closeDisabled) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99990,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(16px, 5vw, 40px)",
      }}
    >
      {/* On a phone the whole screen softens behind the pane. A sibling layer,
          not the scrim's own filter, so the pane still frosts the page. */}
      {compact && (
        <div
          aria-hidden
          className="nijimuProfileVeil"
          data-state={paneState}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backdropFilter: `blur(${SCREEN_BLUR_PX}px)`,
            WebkitBackdropFilter: `blur(${SCREEN_BLUR_PX}px)`,
          }}
        />
      )}
      <div style={{ position: "relative", width: `min(${PANEL_WIDTH}px, 100%)` }}>
        {/* A sibling, not a parent filter: a filtered ancestor would cut the
            pane's backdrop blur off from the page behind it. */}
        <div
          aria-hidden
          className="nijimuProfileCard"
          data-state={paneState}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: PANEL_RADIUS,
            boxShadow: "0 22px 60px rgba(70, 70, 84, 0.09)",
            pointerEvents: "none",
          }}
        />
        <div
          ref={cardRef}
          className="nijimuProfileCard"
          data-state={paneState}
          role="dialog"
          aria-modal="true"
          aria-label={labelledBy ? undefined : label}
          aria-labelledby={labelledBy}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            outline: "none",
            width: "100%",
            maxHeight,
            // a reading pane keeps its size whatever the length of the words
            height: tall ? maxHeight : undefined,
            borderRadius: PANEL_RADIUS,
            overflow: "hidden",
            background: compact
              ? "linear-gradient(165deg, rgba(240, 240, 238, 0.50), rgba(240, 240, 238, 0.42))"
              : "linear-gradient(165deg, rgba(240, 240, 238, 0.42), rgba(240, 240, 238, 0.32))",
            backdropFilter: compact ? "blur(26px) saturate(1.1)" : "blur(16px) saturate(1.15)",
            WebkitBackdropFilter: compact ? "blur(26px) saturate(1.1)" : "blur(16px) saturate(1.15)",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 1,
              opacity: 0.22,
              backgroundImage: GRAIN_URL,
              backgroundRepeat: "repeat",
              // half the tile, half the grain: the noise is vector, so it stays crisp
              backgroundSize: "256px 256px",
              mixBlendMode: "soft-light",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 2,
              boxSizing: "border-box",
              maxHeight,
              height: tall ? "100%" : undefined,
              overflowY: "auto",
              // a scroll that reaches the end stays in the pane, not the page behind
              overscrollBehavior: "contain",
              display: "flex",
              flexDirection: "column",
              alignItems: align === "start" ? "stretch" : "center",
              gap: align === "start" ? PANE_CONTENT_GAP * 1.5 : "clamp(20px, 4vh, 30px)",
              padding: `calc(clamp(32px, 7vw, 44px) - 4px) clamp(24px, 6.4vw, 44px) calc(clamp(30px, 6.4vw, 40px) - ${PANE_ACTION.paddingY}px - 4px)`,
            }}
          >
            {children}
          </div>
        </div>
      </div>

      <style>{`
        .nijimuPaneBody > p { margin: 0; }
        .nijimuPaneBody > p + p { margin-top: .4em; }

        /* Transitions, not keyframes: a pane closed while it is still opening,
           or opened again as it leaves, turns round from where it is. */
        .nijimuProfileScrim {
          background-color: rgba(108, 108, 122, 0.1);
          transition: background-color 240ms ease;
        }
        .nijimuProfileVeil {
          transition: opacity 280ms ease;
        }
        .nijimuProfileCard {
          transition: opacity 320ms ${CARD_EASE}, transform 320ms ${CARD_EASE};
        }
        .nijimuProfileScrim:not([data-state="in"]) { background-color: rgba(108, 108, 122, 0); }
        .nijimuProfileVeil:not([data-state="in"]) { opacity: 0; }
        .nijimuProfileCard[data-state="from"] { opacity: 0; transform: translateY(12px) scale(0.965); }
        .nijimuProfileCard[data-state="out"] { opacity: 0; transform: translateY(6px) scale(0.985); }
        /* leaving is quicker than arriving */
        .nijimuProfileScrim[data-state="out"],
        .nijimuProfileVeil[data-state="out"],
        .nijimuProfileCard[data-state="out"] {
          transition-duration: ${LEAVE_MS}ms;
          transition-timing-function: ease;
        }
        @media (prefers-reduced-motion: reduce) {
          .nijimuProfileCard { transform: none !important; transition: opacity 200ms ease; }
        }
      `}</style>
    </div>
  );
}
