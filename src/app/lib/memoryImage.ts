import { CHROME_GRAY } from "./colors";
import { SERIF, SERIF_CJK } from "./theme";
import { createPuddleSimulation } from "./puddle/simulation";
import { DIVE_TUNING } from "./puddle/dive";

/** Wrap the complete passage, including paragraph breaks and unspaced text. */
export function imageTextLines(text: string, width: number, measure: (text: string) => number, balanceEnd = false): string[] {
  return text.split(/\r?\n/).flatMap(paragraph => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next) <= width) { line = next; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const char of word) {
        if (line && measure(line + char) > width) { lines.push(line); line = ""; }
        line += char;
      }
    }
    lines.push(line);
    if (balanceEnd && lines.length > 1) {
      const last = lines.at(-1)!;
      // There are no page breaks in this image. Avoid a stranded word or a
      // very short final line by rebalancing the last two lines per paragraph.
      if (measure(last) < width * .35 || last.trim().split(/\s+/).length === 1) {
        const previous = lines.at(-2)!;
        const spaced = /\s/.test(previous + last);
        const units = spaced ? `${previous} ${last}`.split(/\s+/) : Array.from(previous + last);
        const join = spaced ? " " : "";
        let best: [string, string] | null = null;
        let difference = Infinity;
        for (let split = 2; split <= units.length - 2; split++) {
          const a = units.slice(0, split).join(join), b = units.slice(split).join(join);
          const aw = measure(a), bw = measure(b);
          if (aw <= width && bw <= width && Math.abs(aw - bw) < difference) {
            best = [a, b]; difference = Math.abs(aw - bw);
          }
        }
        if (best) lines.splice(-2, 2, ...best);
      }
    }
    return lines;
  });
}

/** Copy in the renderer's frame, before WebGL clears its drawing buffer. */
export function copyArtifactFrame(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width = source.width; copy.height = source.height;
  const context = copy.getContext("2d");
  if (!context) throw new Error("Image canvas unavailable");
  context.drawImage(source, 0, 0);
  return copy;
}

export async function memoryImage(artifact: HTMLCanvasElement, title: string, year: string, transcript: string): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`28px ${SERIF}`),
    document.fonts.load(`32px ${SERIF_CJK}`, "滲む nijimu"),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image canvas unavailable");
  ctx.font = `36px ${SERIF}`;
  const titles = imageTextLines(title, 960, text => ctx.measureText(text).width);
  ctx.font = `28px ${SERIF}`;
  const lines = imageTextLines(transcript, 900, text => ctx.measureText(text).width, true);
  const transcriptLineHeight = 40;
  const headerY = 80;
  const headerHeight = 32;
  const titleY = 1190;
  const yearY = titleY + titles.length * 48 + 12;
  const textY = yearY + 100;
  canvas.height = Math.max(1600, textY + lines.length * transcriptLineHeight + 120);

  // Render only the gallery's water pass: artifacts and gallery chrome are
  // separate DOM layers, so none can appear in this background.
  const water = document.createElement("canvas");
  water.width = 1200; water.height = Math.min(canvas.height, 2048);
  Object.assign(water.style, { position: "fixed", left: "-20000px", width: "1200px", height: `${water.height}px` });
  document.body.append(water);
  let sim: ReturnType<typeof createPuddleSimulation> = null;
  try {
    sim = createPuddleSimulation(water);
    if (!sim) throw new Error("Gallery water renderer unavailable");
    sim.setDive({ x: .5, y: .5, zoom: DIVE_TUNING.zoom, blur: DIVE_TUNING.blur, wash: DIVE_TUNING.wash });
    sim.render(12);
    ctx.drawImage(water, 0, 0, canvas.width, canvas.height);
  } finally {
    sim?.dispose();
    water.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
    water.remove();
  }

  ctx.fillStyle = CHROME_GRAY;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `32px ${SERIF_CJK}`;
  const jp = ctx.measureText("滲む").width, en = ctx.measureText("nijimu").width, gap = 32;
  ctx.textAlign = "left";
  const logoX = (canvas.width - jp - en - gap) / 2;
  ctx.fillText("滲む", logoX, headerY);
  ctx.fillText("nijimu", logoX + jp + gap, headerY);
  // Keep the smaller artifact midway between the header and first title line.
  const artifactSize = 864;
  const artifactY = (headerY + headerHeight + titleY - artifactSize) / 2;
  ctx.drawImage(artifact, (canvas.width - artifactSize) / 2, artifactY, artifactSize, artifactSize);
  ctx.textAlign = "center";
  ctx.font = `36px ${SERIF}`;
  titles.forEach((line, i) => ctx.fillText(line, 600, titleY + i * 48));
  ctx.font = `24px ${SERIF}`;
  ctx.fillText(year, 600, yearY);
  ctx.font = `28px ${SERIF}`;
  ctx.textAlign = "center";
  lines.forEach((line, i) => ctx.fillText(line, 600, textY + i * transcriptLineHeight));
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image export failed")), "image/png"));
}

export function downloadMemoryImage(blob: Blob, title: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nijimu-${title.replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s+/g, "-").slice(0, 80) || "memory"}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  // Downloads can start after the event returns, especially on mobile Safari.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
