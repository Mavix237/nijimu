import type { StudioSettings } from "./studioSettings";

/*
 * The studio's kept vessels: every setting (form, tune, modes, room, film,
 * reflection, sheen, view, frame, backdrop) with its photo, on this machine.
 * IndexedDB, not localStorage: a photo is a few MB, past what localStorage
 * holds. The photo is kept as a Blob of its own — never as the URL it was
 * shown from, which may be a bundled asset whose hashed name changes with a
 * build, or an upload that lives only in the panel — and comes back as a data
 * URL, so a vessel loaded from here survives a reload of the page too.
 */

export interface SavedVessel {
  id: string;
  name: string;
  savedAt: number;
  /** Everything but the photo, which is `photo`. */
  settings: Omit<StudioSettings, "photo">;
  photo: Blob | null;
}
export type SavedSummary = Pick<SavedVessel, "id" | "name" | "savedAt">;

const DB = "nijimu-studio";
const STORE = "vessels";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? req.error ?? new Error("storage failed"));
    });
  } finally {
    db.close();
  }
}

export async function listSaved(): Promise<SavedSummary[]> {
  const all = await run("readonly", (s) => s.getAll() as IDBRequest<SavedVessel[]>);
  return all.map(({ id, name, savedAt }) => ({ id, name, savedAt })).sort((a, b) => b.savedAt - a.savedAt);
}

/** The photo as it is shown (a data URL, an asset, an upload) → a Blob to keep. */
export async function photoBlob(url: string): Promise<Blob | null> {
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`the photo could not be read (${res.status})`);
  return res.blob();
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("the photo could not be read"));
    reader.readAsDataURL(blob);
  });
}

/** Keeps the vessel under `name`; a vessel already kept under that name is replaced. Returns its id and whether it replaced one. */
export async function saveVessel(name: string, settings: StudioSettings): Promise<{ id: string; replaced: boolean }> {
  const { photo: url, ...rest } = settings;
  const photo = await photoBlob(url);
  const existing = (await listSaved()).find((v) => v.name === name);
  const id = existing?.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const record: SavedVessel = { id, name, savedAt: Date.now(), settings: rest, photo };
  await run("readwrite", (s) => s.put(record));
  return { id, replaced: !!existing };
}

/** A kept vessel's settings, its photo back as a data URL. */
export async function loadSaved(id: string): Promise<{ name: string; settings: StudioSettings } | null> {
  const record = await run("readonly", (s) => s.get(id) as IDBRequest<SavedVessel | undefined>);
  if (!record) return null;
  const photo = record.photo ? await blobToDataUrl(record.photo) : "";
  return { name: record.name, settings: { ...record.settings, photo } as StudioSettings };
}

export async function deleteSaved(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}
