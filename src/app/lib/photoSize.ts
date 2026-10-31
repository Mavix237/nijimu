/*
 * How large a photo is allowed to be. A phone's camera hands over 12 MP or
 * more; the strip shows it a few hundred pixels across, and every canvas that
 * draws it holds its own decoded copy on the GPU (with mipmaps, a third more).
 */

/** Longest side kept when a photo is chosen: crisp in the film strip at full
    width on a large screen, and small enough to keep in the history draft. */
export const PHOTO_MAX = 1600;

/** Longest side of a photo as a texture inside a vessel: a seat is at most
    360 css px, of which the picture spans about two thirds. */
export const SEAT_PHOTO_MAX = 1024;

/** Re-encoded above this many bytes even when small enough in pixels. */
const BYTES_MAX = 1.5 * 1024 * 1024;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result) : reject(new Error("Could not read photo"));
    reader.onerror = () => reject(reader.error);
    reader.onabort = () => reject(new Error("Photo reading cancelled"));
    reader.readAsDataURL(file);
  });
}

function decode(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    // an <img> applies the photo's EXIF orientation, so a portrait shot stays upright
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not decode photo")); };
    image.src = url;
  });
}

/** The image drawn at most `max` on its longest side, or the image itself if it is already that small. */
export function scaledImage<T extends CanvasImageSource & { width: number; height: number }>(image: T, max: number): T | HTMLCanvasElement {
  const w = (image as HTMLImageElement).naturalWidth || image.width;
  const h = (image as HTMLImageElement).naturalHeight || image.height;
  const k = max / Math.max(w, h, 1);
  if (k >= 1) return image;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) return image;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * A chosen photo as a data URL (it has to survive a refresh in the history
 * draft), at most PHOTO_MAX on its longest side. A photo already that small
 * and light is kept byte for byte; anything else is redrawn as a JPEG.
 */
export async function readPhoto(file: File, max = PHOTO_MAX): Promise<string> {
  let image: HTMLImageElement;
  try { image = await decode(file); } catch { return readAsDataUrl(file); }
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (longest <= max && file.size <= BYTES_MAX) return readAsDataUrl(file);
  const k = Math.min(1, max / Math.max(longest, 1));
  const flat = document.createElement("canvas");
  flat.width = Math.max(1, Math.round(image.naturalWidth * k));
  flat.height = Math.max(1, Math.round(image.naturalHeight * k));
  const ctx = flat.getContext("2d");
  if (!ctx) return readAsDataUrl(file);
  // a transparent PNG would turn black as a JPEG: lay it on the paper first
  ctx.fillStyle = "#f2f2f0";
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, flat.width, flat.height);
  return flat.toDataURL("image/jpeg", 0.88);
}
