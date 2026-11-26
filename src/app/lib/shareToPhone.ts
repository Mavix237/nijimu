/*
 * Save to phone (desktop only): the memory's card goes to /api/share, which keeps it for
 * about a day behind an unguessable id; a QR code of /keep/<id> lets a phone open it and
 * save it to its photos. Never throws: a failure comes back as `error`.
 */

import { getLang, messages } from "./i18n";

/** Under the endpoint's 4 MB cap, with room to spare. */
const MAX_BYTES = 3.6 * 1024 * 1024;

/** The card as a JPEG small enough to send (the PNG a download keeps is several MB). */
async function jpegOf(card: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(card);
  try {
    for (const [scale, quality] of [[1, .9], [1, .82], [.75, .85], [.5, .85]] as const) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      // the card has no transparency to keep; JPEG would turn it black
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (jpeg && jpeg.size <= MAX_BYTES) return jpeg;
    }
    throw new Error("too large");
  } finally {
    bitmap.close();
  }
}

export type PhoneLink = { link: string; expiresAt: string } | { error: string };

export async function keepForPhone(card: Blob, signal?: AbortSignal): Promise<PhoneLink> {
  let body: Blob;
  try {
    body = await jpegOf(card);
  } catch {
    return { error: messages().phonePrepareFailed };
  }
  try {
    const res = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body, signal });
    const data = await res.json().catch(() => ({})) as { id?: string; expiresAt?: string; origin?: string; error?: string };
    // the server's reasons are English; the dictionary says the one a guest can act on
    if (!res.ok || !data.id) return { error: res.status === 503 ? messages().phoneNotSetUp : messages().phoneSendFailed };
    // the dev server names an address a phone on the same network can reach
    const origin = data.origin ?? window.location.origin;
    // the phone opens it in the language chosen here
    return { link: `${origin}/keep/${data.id}${getLang() === "zh" ? "?lang=zh" : ""}`, expiresAt: data.expiresAt ?? "" };
  } catch {
    if (signal?.aborted) return { error: "" };
    return { error: messages().phoneOffline };
  }
}

/** The QR code for a link, as an SVG data URL in the page's ink (qrcode, loaded only when asked). */
export async function qrCodeOf(link: string, ink: string): Promise<string> {
  const QR = await import("qrcode");
  const svg = await QR.toString(link, {
    type: "svg", errorCorrectionLevel: "M", margin: 0,
    color: { dark: ink, light: "#00000000" },
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
