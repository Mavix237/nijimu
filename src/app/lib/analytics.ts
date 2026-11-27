/**
 * Google Analytics (GA4), page views only. Nothing of a memory is sent — no words, names, photos or
 * recordings; only the address, the page's title and what GA gathers on its own.
 *
 * - Runs on nijimu.space alone, so local work and Vercel previews stay out of the numbers.
 *   `?analytics=debug` loads it anywhere for this visit, in GA's debug mode (Admin → DebugView).
 * - Never on `/keep/:id`: that address carries the id that opens a saved card for a day, so the phone
 *   page loads nothing from Google. Every address sent is also passed through `cleanPath`, which writes
 *   any `/keep/<id>` as `/keep`, in case one is ever reached another way.
 * - Page changes in the app are pushState, not loads; GA4's enhanced measurement ("page changes based on
 *   browser history events", on by default for the stream) counts them, with the location set here.
 */
const MEASUREMENT_ID = "G-KJ4XS9DK9M";

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const cleanPath = (path: string) => path.replace(/^\/keep\/[^/?#]+/, "/keep");

function cleanLocation() {
  const { origin, pathname, search } = window.location;
  return origin + cleanPath(pathname) + search;
}

export function startAnalytics() {
  if (typeof window === "undefined" || window.gtag) return;
  const debug = new URLSearchParams(window.location.search).get("analytics") === "debug";
  const host = window.location.hostname;
  const live = host === "nijimu.space" || host === "www.nijimu.space";
  if (!live && !debug) return;
  if (window.location.pathname.startsWith("/keep")) return;

  window.dataLayer = window.dataLayer || [];
  // gtag reads its arguments object, not an array — keep this a plain function
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, {
    page_location: cleanLocation(),
    ...(debug ? { debug_mode: true } : {}),
  });

  // keep the location GA reads clean as the app moves between pages
  const follow = () => window.gtag?.("set", { page_location: cleanLocation() });
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args);
      follow();
      return result;
    };
  }
  window.addEventListener("popstate", follow);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}
