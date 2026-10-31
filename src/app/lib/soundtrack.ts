/**
 * The soundtrack: one player for the whole visit, outside React, so no page
 * change — inside the root layout or out of it (the labs, /style) — stops or
 * restarts it. Whether the music is on and where it had got to are kept in
 * sessionStorage, so a reload or a full page load carries on from there.
 */
import { useEffect, useSyncExternalStore } from "react";

const SOUNDTRACK_URL =
  "https://cdn.jsdelivr.net/gh/Noyok1vas/figbuildAssets/prodarmaan%20-%20somber%20springtime.mp3";
const STORAGE_KEY = "nijimu.soundtrack";
const VOLUME = 0.35;

type Saved = { on: boolean; at: number };

let audio: HTMLAudioElement | null = null;
let muted = true;
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
  if (!audio) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ on: !muted, at: audio.currentTime } satisfies Saved));
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
      player.muted = muted;
      player.play().catch(() => {});
    };
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
  });
}

function start() {
  if (audio || typeof window === "undefined") return;
  const saved = read();
  muted = !saved?.on;
  const player = new Audio(SOUNDTRACK_URL);
  player.loop = true;
  player.volume = VOLUME;
  player.muted = muted;
  if (saved?.at) {
    player.addEventListener("loadedmetadata", () => {
      player.currentTime = Number.isFinite(player.duration) && player.duration > 0 ? saved.at % player.duration : saved.at;
    }, { once: true });
  }
  audio = player;
  play(player);
  window.addEventListener("pagehide", save);
  listeners.forEach((listener) => listener());
}

export function setSoundtrackMuted(next: boolean) {
  start();
  muted = next;
  if (audio) {
    audio.muted = next;
    if (!next && audio.paused) play(audio);
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
});
