#!/usr/bin/env node
/*
 * The CJK characters the interface's dictionary uses (src/app/lib/i18n.ts:
 * the `zh` table, and the English table's "中文" for the toggle), for the
 * GenRyuMin2 TW "-zh" font subset.
 *
 *   node scripts/zh-ui-chars.mjs          # the characters, for pyftsubset --text
 *   node scripts/zh-ui-chars.mjs --range  # the unicode-range for fonts.css
 *
 * Only characters inside the full face's own range (U+3000–FF60) count: the
 * rest (Latin, … — ·) come from the Latin faces, as before. See README, "Fonts".
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../src/app/lib/i18n.ts", import.meta.url)), "utf8");
const start = source.indexOf("const en = {");
const end = source.indexOf("export const MESSAGES", start);
if (start < 0 || end < 0) throw new Error("the dictionary was not found in i18n.ts");

const points = [...new Set([...source.slice(start, end)].map((ch) => ch.codePointAt(0)))]
  .filter((cp) => cp >= 0x3000 && cp <= 0xff60)
  .sort((a, b) => a - b);

if (process.argv.includes("--range")) {
  const ranges = [];
  for (const cp of points) {
    const last = ranges[ranges.length - 1];
    if (last && cp === last[1] + 1) last[1] = cp;
    else ranges.push([cp, cp]);
  }
  const hex = (cp) => cp.toString(16).toUpperCase().padStart(4, "0");
  console.log(ranges.map(([a, b]) => (a === b ? `U+${hex(a)}` : `U+${hex(a)}-${hex(b)}`)).join(", "));
} else {
  console.log(String.fromCodePoint(...points));
}
