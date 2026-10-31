import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CHROME_GRAY } from "./lib/colors";
import { LandingPage } from "./components/LandingPage";
import { HEADER_ICON_LABEL_PAD, HeaderIconLabel } from "./components/HeaderIconLabel";
import { ProfilePanel } from "./components/ProfilePanel";
import { HEADER_MENU_ORDER, HeaderMenu, HeaderMenuContext, HeaderMenuRow, useHeaderMenu } from "./components/HeaderMenu";
import { useCompact } from "./hooks/useCompact";
import { setSoundtrackMuted, useSoundtrack } from "./lib/soundtrack";

/** GitHub Pages subpath: Vite sets BASE_URL from vite.config base (e.g. /repo/). */
const routerBasename =
  import.meta.env.BASE_URL === "/" || import.meta.env.BASE_URL === ""
    ? undefined
    : import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

function RootLayout() {
  const [profileOpen, setProfileOpen] = useState(false);
  // on a phone the header's corner icons fold into one menu (HeaderMenu.tsx)
  const compact = useCompact();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuList, setMenuList] = useState<HTMLElement | null>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const headerMenu = useMemo(() => ({ list: compact ? menuList : null, close: closeMenu }), [compact, menuList, closeMenu]);

  return (
    <HeaderMenuContext.Provider value={headerMenu}>
      <GlobalControls profileOpen={profileOpen} onProfileOpenChange={setProfileOpen}
        menu={compact ? { open: menuOpen, onOpenChange: setMenuOpen, listRef: setMenuList } : null} />
      <Outlet />
    </HeaderMenuContext.Provider>
  );
}

const router = createBrowserRouter([
  {
    Component: RootLayout,
    HydrateFallback: () => null,
    children: [
      { path: "/", Component: LandingPage },
      { path: "*", element: <Navigate to="/" replace /> },
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
  // one player for the visit (lib/soundtrack.ts): no page change restarts it
  const muted = useSoundtrack();
  const { pathname } = useLocation();
  const onMenuOpenChange = menu?.onOpenChange;

  /** The pane belongs to the page it opened over — leaving that page closes it. */
  useEffect(() => {
    onProfileOpenChange(false);
  }, [pathname, onProfileOpenChange]);

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
        <HeaderMenu open={menu.open} onOpenChange={menu.onOpenChange} listRef={menu.listRef} />
        {menuList && (
          <HeaderMenuRow order={HEADER_MENU_ORDER.music} icon={musicGlyph} label={muted ? "music off" : "music on"}
            ariaLabel={muted ? "unmute" : "mute"} onClick={() => setSoundtrackMuted(!muted)} />
        )}
        <ProfilePanel open={profileOpen} onClose={() => onProfileOpenChange(false)} />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setSoundtrackMuted(!muted)}
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
