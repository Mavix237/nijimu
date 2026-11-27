// Writes dist/memory.html: the built index.html with /memory's own title, description, canonical and
// Open Graph / Twitter words, so a crawler or a link preview that does not run the app reads the
// gallery's head at /memory rather than the landing's (vercel.json rewrites /memory to it). The app
// itself is the same; at runtime lib/pageHead.ts sets the same words (keep the two in step).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = join(root, "dist", "index.html");

const SITE = "https://nijimu.space";
const ROUTES = [
  {
    file: "memory.html",
    url: `${SITE}/memory`,
    title: "memory gallery — nijimu 滲む",
    description:
      "A gallery of memories kept as glass vessels, each holding its words and a photograph. Move through them in time, or begin one of your own.",
  },
];

const escape = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function swap(html, pattern, replacement, what) {
  if (!pattern.test(html)) throw new Error(`route-heads: no ${what} in dist/index.html`);
  return html.replace(pattern, replacement);
}

if (!existsSync(indexHtml)) {
  console.warn("route-heads: dist/index.html missing — run vite build first");
  process.exitCode = 1;
} else {
  const base = readFileSync(indexHtml, "utf8");
  for (const route of ROUTES) {
    const title = escape(route.title);
    const description = escape(route.description);
    let html = base;
    html = swap(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`, "<title>");
    html = swap(html, /(<meta name="description" content=")[^"]*(")/, `$1${description}$2`, "description");
    html = swap(html, /(<link rel="canonical" href=")[^"]*(")/, `$1${route.url}$2`, "canonical");
    html = swap(html, /(<meta property="og:url" content=")[^"]*(")/, `$1${route.url}$2`, "og:url");
    html = swap(html, /(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`, "og:title");
    html = swap(html, /(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`, "og:description");
    html = swap(html, /(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`, "twitter:title");
    html = swap(html, /(<meta name="twitter:description" content=")[^"]*(")/, `$1${description}$2`, "twitter:description");
    writeFileSync(join(root, "dist", route.file), html);
    console.log(`Wrote dist/${route.file} (${route.url})`);
  }
}
