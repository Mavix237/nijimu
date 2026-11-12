/**
 * The soundtrack: one player for the whole visit, outside React, so no page
 * change — inside the root layout or out of it (the labs, /style) — stops or
 * restarts it. Whether the music is on and where it had got to are kept in
 * sessionStorage, so a reload or a full page load carries on from there.
 *
 * The file is large (~9 MB), so it is not fetched until the music is on: a
 * visit that never turns it on never downloads it. Muting pauses it.
 */
import { useEffect, useSyncExternalStore } from "react";

const SOUNDTRACK_URL =
  "https://cdn.jsdelivr.net/gh/Noyok1vas/figbuildAssets/prodarmaan%20-%20somber%20springtime.mp3";
const STORAGE_KEY = "nijimu.soundtrack";
const VOLUME = 0.35;

type Saved = { on: boolean; at: number };

let audio: HTMLAudioElement | null = null;
let muted = true;
let begun = false;
/** Where the music had got to, carried until a player exists to take it. */
let savedAt = 0;
const listeners = new Set<() => void>();

function read(): Saved | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    return saved && typeof saved.on === "boolean" && Number.isFinite(saved.at) ? saved : null;
  } catch {
    return null;
  }
}

function save() {
  if (!begun) return;
  try {
    const at = audio ? audio.currentTime : savedAt;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ on: !muted, at } satisfies Saved));
  } catch {
    // storage refused: the music still plays, it just starts over next load
  }
}

/** Plays; where the browser refuses sound before a gesture, it plays silently
 * (so the place keeps moving) and takes up its sound at the first press. */
function play(player: HTMLAudioElement) {
  player.play().catch(() => {
    player.muted = true;
    player.play().catch(() => {});
    const resume = () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      if (muted) return; // turned off meanwhile: stay paused
      player.muted = false;
      player.play().catch(() => {});
    };
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
  });
}

/** Makes the player, from where the music had got to. Only once it is wanted. */
function createPlayer(): HTMLAudioElement {
  const player = new Audio(SOUNDTRACK_URL);
  player.loop = true;
  player.volume = VOLUME;
  player.muted = muted;
  const at = savedAt;
  if (at) {
    player.addEventListener("loadedmetadata", () => {
      player.currentTime = Number.isFinite(player.duration) && player.duration > 0 ? at % player.duration : at;
    }, { once: true });
  }
  audio = player;
  return player;
}

function start() {
  if (begun || typeof window === "undefined") return;
  begun = true;
  const saved = read();
  muted = !saved?.on;
  savedAt = saved?.at ?? 0;
  if (!muted) play(createPlayer());
  window.addEventListener("pagehide", save);
  listeners.forEach((listener) => listener());
}

export function setSoundtrackMuted(next: boolean) {
  start();
  muted = next;
  if (next) {
    if (audio) {
      audio.muted = true;
      audio.pause();
    }
  } else {
    const player = audio ?? createPlayer();
    player.muted = false;
    if (player.paused) play(player);
  }
  save();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Starts the soundtrack (once per visit) and reads whether it is muted. */
export function useSoundtrack() {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, () => muted, () => true);
}

// an edit to this module in development hands the place on rather than doubling the music
import.meta.hot?.dispose(() => {
  save();
  window.removeEventListener("pagehide", save);
  audio?.pause();
  audio = null;
  begun = false;
});
