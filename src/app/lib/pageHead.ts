/**
 * The page's head as the route and the language change: <title>, the description, canonical and the
 * Open Graph / Twitter words, and a robots "noindex" on every route that is not one of the two public
 * ones (`/` and `/memory`). The static tags in index.html are the English landing's, what crawlers and
 * link previews read first; scripts/route-heads.mjs writes /memory's own copy of them at build time.
 *
 * The words live here, not in the i18n dictionary: they are never drawn on the page, so they must not
 * grow the Chinese font subset (GenRyuMin2TW-Regular-zh) that is cut from the dictionary's characters.
 *
 * /keep/:id sets its own title and noindex (KeepOnPhonePage) and is left alone.
 */
import { getLang, onLangChange, type Lang } from "./i18n";
import { CAROUSEL_PATH, MEMORY_POND_PATH, NAMING_PATH, RECORD_START_PATH, TRANSCRIPT_PATH, isDescentPath } from "./routes";

export const SITE_ORIGIN = "https://www.nijimu.space";

/** The routes a search engine may index; the sitemap lists the same two (public/sitemap.xml). */
export const INDEXABLE_PATHS = ["/", CAROUSEL_PATH] as const;

type Head = { title: string; description: string };

const HEADS: Record<Lang, { home: Head; gallery: Head; create: string; other: string }> = {
  en: {
    home: {
      title: "nijimu 滲む — an interactive memory sculpting tool",
      description:
        "nijimu (滲む, to blur and bleed into) is an interactive memory sculpting tool to trace how memory evolves: speak a memory, then shape it by hand into a glass vessel.",
    },
    gallery: {
      title: "memory gallery — nijimu 滲む",
      description:
        "A gallery of memories kept as glass vessels, each holding its words and a photograph. Move through them in time, or begin one of your own.",
    },
    create: "a new memory — nijimu 滲む",
    other: "nijimu 滲む",
  },
  zh: {
    home: {
      title: "滲む nijimu — 互动的记忆雕塑工具",
      description: "滲む nijimu 是一个互动的记忆雕塑工具，追溯记忆如何流转：说出一段记忆，再用双手把它塑成一只玻璃器皿。",
    },
    gallery: {
      title: "记忆画廊 — 滲む nijimu",
      description: "一座记忆的画廊：每段记忆化作一只玻璃器皿，留着它的话语与一张照片。在时间里翻看它们，或开始你自己的一段。",
    },
    create: "新的记忆 — 滲む nijimu",
    other: "滲む nijimu",
  },
};

const OG_LOCALE: Record<Lang, string> = { en: "en_US", zh: "zh_CN" };

function isCreatePath(pathname: string) {
  return pathname === MEMORY_POND_PATH || pathname === RECORD_START_PATH || pathname === TRANSCRIPT_PATH
    || pathname === NAMING_PATH || isDescentPath(pathname);
}

/** The head for a path, or null where a page keeps its own (the phone's /keep page). */
export function headFor(pathname: string, lang: Lang): (Head & { indexable: boolean }) | null {
  if (pathname.startsWith("/keep/")) return null;
  const words = HEADS[lang];
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/") return { ...words.home, indexable: true };
  if (path === CAROUSEL_PATH) return { ...words.gallery, indexable: true };
  const title = isCreatePath(path) ? words.create : words.other;
  return { title, description: words.home.description, indexable: false };
}

function meta(attr: "name" | "property", key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  if (el.content !== value) el.content = value;
}

/** Sets the head for this path in the language now chosen. */
export function applyPageHead(pathname: string) {
  if (typeof document === "undefined") return;
  const lang = getLang();
  const head = headFor(pathname, lang);
  if (!head) return;
  if (document.title !== head.title) document.title = head.title;
  meta("name", "description", head.description);
  meta("property", "og:title", head.title);
  meta("property", "og:description", head.description);
  meta("property", "og:locale", OG_LOCALE[lang]);
  meta("name", "twitter:title", head.title);
  meta("name", "twitter:description", head.description);

  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const url = `${SITE_ORIGIN}${path === "/" ? "/" : path}`;
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  let robots = document.head.querySelector<HTMLMetaElement>("meta[data-page-head-robots]");
  if (head.indexable) {
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    if (canonical.href !== url) canonical.href = url;
    meta("property", "og:url", url);
    robots?.remove();
  } else {
    // a route that is not public points nowhere and asks not to be indexed (vercel.json sends the same as a header)
    canonical?.remove();
    meta("property", "og:url", `${SITE_ORIGIN}/`);
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      robots.setAttribute("data-page-head-robots", "");
      document.head.appendChild(robots);
    }
    robots.content = "noindex";
  }
}

type RouterLike = {
  state: { location: { pathname: string } };
  subscribe: (fn: (state: { location: { pathname: string } }) => void) => () => void;
};

/** Follows the router and the language for the life of the page. */
export function startPageHead(router: RouterLike) {
  let pathname = router.state.location.pathname;
  applyPageHead(pathname);
  router.subscribe((state) => {
    if (state.location.pathname === pathname) return;
    pathname = state.location.pathname;
    applyPageHead(pathname);
  });
  onLangChange(() => applyPageHead(pathname));
}
