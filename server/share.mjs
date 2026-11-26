// Save to phone: the memory's card, held for about a day behind an unguessable link so a
// phone can open it from a QR code. Plain JavaScript on purpose (see AGENTS.md §9).
//
// The image is stored privately (Vercel Blob, access "private" by default) and only ever
// served back through GET /api/share, which refuses anything older than SHARE_TTL_MS. The
// sweep (a daily cron, and a pass on each upload) deletes what has expired.
import { randomBytes } from "node:crypto";

/** How long a shared card can be opened. */
export const SHARE_TTL_MS = 24 * 60 * 60 * 1000;
/** Vercel functions take bodies up to 4.5 MB; the browser sends a JPEG well under this. */
export const SHARE_MAX_BYTES = 4 * 1024 * 1024;
const TYPES = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };
const PREFIX = "keep/";
/** 16 random bytes, base64url: 22 characters, not guessable. */
const ID = /^[A-Za-z0-9_-]{22}$/;

export const newShareId = () => randomBytes(16).toString("base64url");
export const isShareId = (id) => typeof id === "string" && ID.test(id);

/**
 * @typedef {{ bytes: Uint8Array | ReadableStream<Uint8Array>, contentType: string, uploadedAt: Date }} StoredImage
 * @typedef {{
 *   put(id: string, bytes: Uint8Array, contentType: string): Promise<void>,
 *   get(id: string): Promise<StoredImage | null>,
 *   sweep(now: number): Promise<number>,
 * }} ShareStore
 */

/**
 * The production store: Vercel Blob. `access` must match the store's own setting
 * (create the store as Private; SHARE_BLOB_ACCESS=public only for a public store).
 * @param {string | undefined} token
 * @param {"private" | "public"} [access]
 * @returns {Promise<ShareStore>}
 */
export async function blobStore(token, access = "private") {
  const { put, get, list, del } = await import("@vercel/blob");
  const pathOf = (id) => `${PREFIX}${id}.jpg`;
  return {
    async put(id, bytes, contentType) {
      await put(pathOf(id), Buffer.from(bytes), {
        access, contentType, token, addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 60,
      });
    },
    async get(id) {
      try {
        const found = await get(pathOf(id), { access, token });
        if (!found || found.statusCode !== 200) return null;
        return { bytes: found.stream, contentType: found.blob.contentType, uploadedAt: new Date(found.blob.uploadedAt) };
      } catch {
        return null;
      }
    },
    async sweep(now) {
      let cursor, gone = 0;
      do {
        const page = await list({ prefix: PREFIX, cursor, limit: 1000, token });
        const old = page.blobs.filter((b) => now - new Date(b.uploadedAt).getTime() > SHARE_TTL_MS).map((b) => b.url);
        if (old.length) await del(old, { token });
        gone += old.length;
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return gone;
    },
  };
}

/**
 * A store in memory, for the dev server when no Blob token is set: lost on restart.
 * @returns {ShareStore}
 */
export function memoryStore() {
  /** @type {Map<string, StoredImage>} */
  const kept = new Map();
  return {
    async put(id, bytes, contentType) { kept.set(id, { bytes, contentType, uploadedAt: new Date() }); },
    async get(id) { return kept.get(id) ?? null; },
    async sweep(now) {
      let gone = 0;
      for (const [id, image] of kept) if (now - image.uploadedAt.getTime() > SHARE_TTL_MS) { kept.delete(id); gone++; }
      return gone;
    },
  };
}

/**
 * POST /api/share: keep the card, answer with its id and when it stops being kept.
 * @param {ShareStore | null} store
 * @param {Uint8Array} bytes
 * @param {string | null | undefined} contentType
 */
export async function createShare(store, bytes, contentType) {
  if (!store) return { status: 503, body: { error: "Saving to a phone isn’t set up here." } };
  const type = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  if (!(type in TYPES)) return { status: 415, body: { error: "Only an image can be kept." } };
  if (!bytes?.length) return { status: 400, body: { error: "The image was empty." } };
  if (bytes.length > SHARE_MAX_BYTES) return { status: 413, body: { error: "The image is too large." } };
  const id = newShareId();
  try {
    await store.put(id, bytes, type);
  } catch {
    return { status: 502, body: { error: "The image couldn’t be kept. Please try again." } };
  }
  // what has expired goes now too (the daily cron catches the rest); never fails the upload
  try { await store.sweep(Date.now()); } catch { /* the cron will */ }
  return { status: 200, body: { id, expiresAt: new Date(Date.now() + SHARE_TTL_MS).toISOString() } };
}

/**
 * GET /api/share?id=…: the image itself, if it is still kept.
 * @param {ShareStore | null} store
 * @param {string | null} id
 * @returns {Promise<{ status: number, body?: object, image?: StoredImage, expiresAt?: string }>}
 */
export async function readShare(store, id) {
  if (!store) return { status: 503, body: { error: "Saving to a phone isn’t set up here." } };
  if (!isShareId(id)) return { status: 404, body: { error: "Not found." } };
  const image = await store.get(id);
  if (!image) return { status: 404, body: { error: "This image is no longer kept." } };
  const age = Date.now() - image.uploadedAt.getTime();
  if (age > SHARE_TTL_MS) return { status: 410, body: { error: "This image is no longer kept." } };
  return { status: 200, image, expiresAt: new Date(image.uploadedAt.getTime() + SHARE_TTL_MS).toISOString() };
}

/** Headers for a kept image: never cached by a shared cache, not indexed. */
export function imageHeaders(image, expiresAt) {
  return {
    "Content-Type": image.contentType,
    "Cache-Control": "private, max-age=600",
    "Content-Disposition": 'inline; filename="nijimu-memory.jpg"',
    "X-Robots-Tag": "noindex, nofollow",
    "X-Expires-At": expiresAt,
    "Referrer-Policy": "no-referrer",
  };
}
