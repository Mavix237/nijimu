import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation, useNavigate } from "react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHROME_GRAY } from "./lib/colors";
import { LandingPage } from "./components/LandingPage";
import {
  CAROUSEL_PATH,
  MEMORY_FIELD_PATH,
  MEMORY_POND_PATH,
  DESCENT_PATH,
  DESCENT_STEP_PATHS,
  NAMING_PATH,
  RECORD_START_PATH,
  TRANSCRIPT_PATH,
} from "./lib/routes";
import {
  LANDING_PAPER,
  LANDING_RETURN,
  LandingReturnContext,
  useLandingReturn,
  type LandingReturnPhase,
} from "./lib/landingReturn";
import { HEADER_ICON_LABEL_PAD, HeaderIconLabel } from "./components/HeaderIconLabel";
import { ProfilePanel } from "./components/ProfilePanel";
import { HEADER_MENU_ORDER, HeaderMenu, HeaderMenuContext, HeaderMenuRow, useHeaderMenu } from "./components/HeaderMenu";
import { useCompact } from "./hooks/useCompact";

const SOUNDTRACK_URL =
  "https://cdn.jsdelivr.net/gh/Noyok1vas/figbuildAssets/prodarmaan%20-%20somber%20springtime.mp3";

/** GitHub Pages subpath: Vite sets BASE_URL from vite.config base (e.g. /repo/). */
const routerBasename =
  import.meta.env.BASE_URL === "/" || import.meta.env.BASE_URL === ""
    ? undefined
    : import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

function RootLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [phase, setPhase] = useState<LandingReturnPhase>("idle");
  const [profileOpen, setProfileOpen] = useState(false);
  // on a phone the header's corner icons fold into one menu (HeaderMenu.tsx)
  const compact = useCompact();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuList, setMenuList] = useState<HTMLElement | null>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const headerMenu = useMemo(() => ({ list: compact ? menuList : null, close: closeMenu }), [compact, menuList, closeMenu]);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const beginReturn = useCallback(() => {
    if (pathname === "/" || phase !== "idle") return;
    setProfileOpen(false);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      navigate("/");
      return;
    }
    clearTimers();
    const { profileLeaveMs, sceneFadeMs, holdMs, contentFadeMs, headerDelayMs, headerFadeMs } = LANDING_RETURN;
    timersRef.current = [
      window.setTimeout(() => setPhase("scene-out"), profileLeaveMs),
      window.setTimeout(() => {
        navigate("/");
        setPhase("holding");
      }, profileLeaveMs + sceneFadeMs),
      window.setTimeout(() => setPhase("landing"), profileLeaveMs + sceneFadeMs + holdMs),
      window.setTimeout(
        () => setPhase("idle"),
        profileLeaveMs + sceneFadeMs + holdMs + contentFadeMs + headerDelayMs + headerFadeMs,
      ),
    ];
  }, [pathname, phase, navigate, clearTimers]);

  const veiled = phase === "scene-out" || phase === "holding";

  return (
    <LandingReturnContext.Provider value={{ phase, beginReturn }}>
    <HeaderMenuContext.Provider value={headerMenu}>
      <GlobalControls profileOpen={profileOpen} onProfileOpenChange={setProfileOpen}
        menu={compact ? { open: menuOpen, onOpenChange: setMenuOpen, listRef: setMenuList } : null} />
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99980,
          background: LANDING_PAPER,
          opacity: veiled ? 1 : 0,
          transition: phase === "scene-out"
            ? `opacity ${LANDING_RETURN.sceneFadeMs}ms ease`
            : "none",
          pointerEvents: veiled ? "auto" : "none",
        }}
      />
      <Outlet />
    </HeaderMenuContext.Provider>
    </LandingReturnContext.Provider>
  );
}

// Old bookmarks enter the current, single-canvas flow with their carried draft.
function ArchivedShapeRedirect() {
  const { state } = useLocation();
  return <Navigate to={DESCENT_PATH} state={state} replace />;
}

function ArchivedTranscriptRedirect() {
  const { state } = useLocation();
  return <Navigate to={DESCENT_PATH} state={state} replace />;
}

const router = createBrowserRouter([
  { path: "/style", HydrateFallback: () => null, lazy: () => import("./components/StyleGuidePage").then((m) => ({ Component: m.StyleGuidePage })) },
  { path: "/lab/descent", HydrateFallback: () => null, lazy: () => import("./lab/DescentPrototype").then((m) => ({ Component: m.DescentPrototype })) },
  { path: "/lab/film", HydrateFallback: () => null, lazy: () => import("./lab/FilmPreview").then((m) => ({ Component: m.FilmPreview })) },
  { path: "/lab/vessel", HydrateFallback: () => null, lazy: () => import("./lab/VesselPreview").then((m) => ({ Component: m.VesselPreview })) },
  {
    Component: RootLayout,
    // a direct visit to a lazily loaded page shows the paper while its code arrives
    HydrateFallback: () => null,
    children: [
      {
        /* Landing, gallery, pond, recording, descent and
           naming share one layout: Enter preloads the gallery behind the ink,
           saving a memory
           turns the naming rim into that same gallery in place. The children
           render nothing themselves; LandingPage reads the path. */
        Component: LandingPage,
        children: [
          { path: "/", element: null },
          { path: CAROUSEL_PATH, element: null },
          { path: MEMORY_POND_PATH, element: null },
          { path: RECORD_START_PATH, element: null },
          { path: DESCENT_PATH, element: null },
          ...Object.values(DESCENT_STEP_PATHS).map(path => ({ path, element: null })),
          { path: NAMING_PATH, element: null },
        ],
      },
      /* Everything off the landing layout loads on its own: the landing must
         not wait for three.js, the labs or the revisit editors. A navigation
         keeps the current page until the next one's code has arrived. */
      { path: MEMORY_FIELD_PATH, lazy: () => import("./components/HomePage").then((m) => ({ Component: m.HomePage })) },
      { path: "/lab/gallery", lazy: () => import("./lab/VesselGalleryPreview").then((m) => ({ Component: m.VesselGalleryPreview })) },
      { path: "/lab/meaning", lazy: () => import("./lab/MemoryMeaningLab").then((m) => ({ Component: m.MemoryMeaningLab })) },
      { path: "/lab/shapes", lazy: () => import("./lab/ShapeLibraryLab").then((m) => ({ Component: m.ShapeLibraryLab })) },
      { path: "/record/shape/:step", Component: ArchivedShapeRedirect },
      { path: TRANSCRIPT_PATH, Component: ArchivedTranscriptRedirect },
      { path: "/record/saved", lazy: () => import("./components/MemorySavedPage").then((m) => ({ Component: m.MemorySavedPage })) },
      { path: "/memory/scroll", lazy: () => import("./components/MemoryScrollPage").then((m) => ({ Component: m.MemoryScrollPage })) },
      { path: "/memory/revisit", lazy: () => import("./components/RevisitMemoryPage").then((m) => ({ Component: m.RevisitMemoryPage })) },
      { path: "/memory/edit/weight", lazy: () => import("./components/EditWeightPage").then((m) => ({ Component: m.EditWeightPage })) },
      { path: "/memory/edit/color", lazy: () => import("./components/EditColorPage").then((m) => ({ Component: m.EditColorPage })) },
      { path: "/memory/edit/texture", lazy: () => import("./components/EditTexturePage").then((m) => ({ Component: m.EditTexturePage })) },
    ],
  },
], { basename: routerBasename });

function GlobalControls({
  profileOpen,
  onProfileOpenChange,
  menu,
}: {
  profileOpen: boolean;
  onProfileOpenChange: (open: boolean) => void;
  /** The folded header on a phone; null draws the corner icons. */
  menu: { open: boolean; onOpenChange: (open: boolean) => void; listRef: (el: HTMLDivElement | null) => void } | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(true);
  const { pathname } = useLocation();
  const { phase } = useLandingReturn();
  const leavingScene = phase === "scene-out" || phase === "holding";

  useEffect(() => {
    const audio = new Audio(SOUNDTRACK_URL);
    audio.loop = true;
    audio.volume = 0.35;
    audio.muted = true;
    audioRef.current = audio;

    const attempt = audio.play();
    if (attempt !== undefined) {
      attempt.catch(() => {
        const resume = () => {
          audio.play().catch(() => {});
          window.removeEventListener("pointerdown", resume);
          window.removeEventListener("keydown", resume);
        };
        window.addEventListener("pointerdown", resume, { once: true });
        window.addEventListener("keydown", resume, { once: true });
      });
    }

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  /** The pane belongs to the page it opened over — leaving that page closes it. */
  useEffect(() => {
    onProfileOpenChange(false);
  }, [pathname, onProfileOpenChange]);

  const onMenuOpenChange = menu?.onOpenChange;
  /** So does the folded menu. */
  useEffect(() => {
    onMenuOpenChange?.(false);
  }, [pathname, onMenuOpenChange]);
  const { list: menuList } = useHeaderMenu();

  const [nameShown, setNameShown] = useState<"music" | null>(null);

  const iconButtonStyle = {
    position: "fixed" as const,
    zIndex: 99999,
    boxSizing: "border-box" as const,
    width: "var(--chrome-icon)",
    height: 36 + HEADER_ICON_LABEL_PAD,
    padding: `0 0 ${HEADER_ICON_LABEL_PAD}px`,
    borderRadius: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const iconStroke = CHROME_GRAY;
  const musicGlyph = muted ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );

  if (menu) {
    return (
      <>
        <HeaderMenu open={menu.open} onOpenChange={menu.onOpenChange} listRef={menu.listRef}
          hidden={leavingScene} />
        {menuList && (
          <HeaderMenuRow order={HEADER_MENU_ORDER.music} icon={musicGlyph} label={muted ? "music off" : "music on"}
            ariaLabel={muted ? "unmute" : "mute"} onClick={() => setMuted((m) => !m)} />
        )}
        <ProfilePanel open={profileOpen} onClose={() => onProfileOpenChange(false)} />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "unmute" : "mute"}
        onMouseEnter={() => setNameShown("music")}
        onMouseLeave={() => setNameShown(null)}
        onFocus={() => setNameShown("music")}
        onBlur={() => setNameShown(null)}
        style={{ ...iconButtonStyle, top: "var(--chrome-top)", right: "var(--chrome-r0)" }}
      >
        <HeaderIconLabel name="music" shown={nameShown === "music"} />
        {musicGlyph}
      </button>

      <ProfilePanel open={profileOpen} onClose={() => onProfileOpenChange(false)} />
    </>
  );
}

export default function App() {
  return <RouterProvider router={router} />;
}
