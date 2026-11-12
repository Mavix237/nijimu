import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { formKey, type ArtifactForm } from "../lib/superformula";
import { prepareFilmPhoto } from "../lib/filmLook";
import { SEAT_PHOTO_MAX, scaledImage } from "../lib/photoSize";
import { LIGHT_TIER, MAX_DPR, RT_SAMPLES } from "../lib/deviceTier";
import { setApexHover } from "../lib/apexHover";
import { useFilmTune } from "../lib/filmTune";
import { cappedVesselDistance, frameVessel } from "../lib/vesselFraming";
import { useVesselParts, type VesselParts } from "./vesselBuilds";
import { createEdgePrint } from "./filmStrip";
import {
  BLANK_PHOTO, FOV, FRONT_LAYER, LOOK_Y, Mist, PITCH_MAX, PITCH_MIN, airFor, backdropVertex, blitFragment, blurFragment, buildGlass,
  createGlassUniformSet, createSheetUniformSet, glassFragment, glassRefractFragment, glassVertex, hash2,
  keyFrom, photoLoader, seedDirections, sheetFragment, sheetVertex, writeGlassUniforms, writeSheetUniforms,
  type Glass, type GlassMode, type Room, type Sheet, type SheetFace, type SheetMode, type VesselTune,
} from "./VesselPreview";
import { SHADER_CHECKS } from "../lib/deviceTier";

/* Hovered at the apex: a float of a few percent of the eye's distance and a
   turn of about a minute a revolution, eased in and out as the mouse comes and goes. */
const HOVER_BOB = 0.004;
const HOVER_BOB_S = 4.5;
const HOVER_SPIN = 0.11;
const HOVER_EASE_S = 0.6;
const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/*
 * One memory as the vessel, in a canvas of its own — what the gallery preview
 * seats where the crystal was. The same glass and sheet as /lab/vessel,
 * drawn with the lab's two-pass refraction on a transparent canvas (the glass
 * shows the room where the frame behind it is empty), without the table or
 * its reflection. The eye opens on the sheet's side of the wall so the picture
 * faces the viewer, and at the apex a drag turns it round and up or down as in
 * the lab (`turn` in the tune adds the lab's slow turn); a neighbour holds
 * still.
 */

export interface VesselArtifactProps {
  /** How much larger than its laid-out box the seat is shown (CSS scale: the
      gallery's canvas room and apex swell). The canvas is measured unscaled
      (offsetSize), so without this it is drawn at the box's size and stretched
      on screen — a 2× stretch put each rendered pixel over two of the
      screen's, the stair-stepped edges. The canvas renders this much denser,
      up to SEAT_DPR_HEADROOM × MAX_DPR. */
  pixelScale?: number;
  form: ArtifactForm;
  /** How far the form has grown from its sphere (the shape step's morph). */
  morph: number;
  photoUrl?: string;
  /** Places this strip's stains and torn ends, and the turn it is first seen at. */
  seed: number;
  tune: VesselTune;
  room: Room;
  glassMode?: GlassMode;
  sheetMode?: SheetMode;
  face?: SheetFace;
  /** At the apex: turning. */
  focused: boolean;
  /** A settled neighbour: nothing moves, the canvas draws on demand. */
  still: boolean;
  frameloop: "always" | "demand";
  /** The gallery sets this to the seat's rounded offset while the rim is
      settled. A parked canvas draws once when it changes. */
  rest?: number;
  /** Names this seat's memory and version. The glass and cloth themselves are
      cached by their contents (vesselBuilds.ts), so a seat that leaves and
      comes back, or the same memory elsewhere, does not rebuild its cloth. */
  cacheKey: string;
  /** Place in the build queue, lowest first: the gallery passes the seat's
      distance from the apex. The focused seat defaults to 0, others to 1. */
  priority?: number;
  /** The strip's size in the glass; fitted to the cavity (`fitSheetSize`) unless given. */
  sheetSize?: number;
  /** The wall angle (degrees) the eye opens on; the sheet's own `anchorAngle` unless given, so a picture hung off it sits to one side. */
  facing?: number;
  /** The eye's height (degrees) it opens at; the tune's `pitch` unless given. */
  viewPitch?: number;
  /** When this changes the eye goes back to exactly `facing`/`viewPitch`, dropping any turn of the viewer's own. */
  viewToken?: string;
  /** The view is held: a drag no longer turns it (a press and release still picks). */
  locked?: boolean;
  /** The view it opens at is kept while the mouse rests on it (no hover turn); a drag still turns it. */
  holdView?: boolean;
  /** As a drag turns the eye: the wall angle it now faces and its height, in degrees. */
  onView?: (facing: number, pitch: number) => void;
  /** Depth softness in CSS pixels of this canvas, before the seat's scale.
      Drawn here so the blur is the same pixels in Safari and Chrome. */
  blurPx?: number;
  /** Optional maximum width as a share of this canvas. The gallery divides
      its seat-width cap by any canvas expansion and library size multiplier. */
  maxViewportWidth?: number;
  /** A press and release without a drag at the apex — the seat is being asked for. */
  onPick?: () => void;
  /** Called after the first complete frame, so arrivals wait for the actual vessel. */
  onReady?: (canvas: HTMLCanvasElement) => void;
  /** A soft mirror image under the foot (the gallery's). Absent or strength 0: none. */
  reflection?: VesselReflection;
  /** A soft studio sheen on the glass's facing wall (the gallery's). Absent or amount 0: none. */
  sheen?: VesselSheen;
  /** The canvas's pixel ratio, in place of the seat's own. The card passes a fixed ratio so every device prints the same frame. */
  dpr?: number;
  /** Set to a function and the next complete frame (with its reflection) is copied and handed to it,
      then the slot is emptied: read in the same task as the render, before WebGL clears its buffer. */
  capture?: { current: ((frame: HTMLCanvasElement) => void) | null };
}

/** A lobe of light fixed to the eye, laid on the facing wall; the vessel turns under it. */
export interface VesselSheen {
  amount: number;
  /** Its core and the tone it eases to at its rim (css colours). */
  color: string;
  edge: string;
  /** Where it sits on the screen, −1…1 (left/bottom … right/top). */
  x: number;
  y: number;
  /** Its size (≈ radians of the surface's turn) and how much of that the gradient spans (0 hard … 1 all gradient). */
  size: number;
  soft: number;
  /** How much it gathers toward the silhouette (0 broad over the face, 1 only at the edge). */
  rim: number;
  /** The lobe's tilt, degrees. */
  tilt: number;
  /** How fast it wanders and how far; how much its brightness breathes. */
  speed: number;
  wander: number;
  breath: number;
  /** 0 laid over the glass as a colour (as built), 1 added as light. */
  add?: number;
}

const sheenColor = new THREE.Color();
function writeSheen(u: ReturnType<typeof createGlassUniformSet>, sheen: VesselSheen | undefined) {
  if (!sheen || sheen.amount <= 0) { u.uSheen0.value = 0; return; }
  u.uSheen0.value = sheen.amount;
  u.uSheenAdd.value = sheen.add ?? 0;
  u.uSheenColor.value.copy(sheenColor.set(sheen.color));
  u.uSheenEdge.value.copy(sheenColor.set(sheen.edge));
  u.uSheenAt.value.set(sheen.x, sheen.y);
  u.uSheenShape.value.set(sheen.size, sheen.soft, sheen.rim, sheen.wander);
  u.uSheenMotion.value.set(sheen.speed, sheen.breath, (sheen.tilt * Math.PI) / 180);
}

/** The vessel mirrored in a still surface just under its foot, fading with depth and softened. */
export interface VesselReflection {
  /** How much of the vessel the mirror gives back at its foot (0 none). */
  strength: number;
  /** World units below the mirror by which it has faded away (the vessels are ~2 tall). */
  fall: number;
  /** The mirror's distance under the foot, world units. */
  gap: number;
  /** Its blur, in CSS pixels of the canvas. */
  soft: number;
  /** Room added under the seat for it, as a share of the seat's height (the vessel itself does not move). */
  room: number;
  /** Laid on water rather than a still floor (naming): rippled, broken, tinted. Absent: the gallery's still mirror. */
  water?: VesselWaterReflection;
}

/**
 * The mirror seen on the lake (naming): one extra full-canvas pass over the
 * blurred reflection that reads the pond's own surface under each pixel — the
 * pond's camera, its wave normal and clock (`surface`) — so the reflection is
 * bent by the same waves and rings the water shows, as strong as the water's
 * Fresnel there (bright toward the horizon, clear near the eye), and never
 * above the horizon.
 */
export interface VesselWaterReflection {
  /** Extra vertical smear, × `soft`. */
  smear: number;
  /** × the true bend of a reflected ray by the wave's slope (1 is physical). */
  ripple: number;
  /** How much more the slope bends it down the screen than across (the view's foreshortening). */
  stretch: number;
  /** 0: even strength; 1: the water's Fresnel decides it. */
  fresnel: number;
  /** How far it takes the water's colour (0 its own). */
  tint: number;
  /** The water's colour (css). */
  color: string;
  /** How much darker the water gives it back. */
  darken: number;
  /** The landing: how far under the waterline (share of the canvas's height) the reflection stays clear. */
  contact: number;
  /** How clear it is there: unblurred and unbent (0 as the rest, 1 sharp). */
  contactSharp: number;
  /** How strong it is there at least, whatever the Fresnel. */
  contactStrength: number;
  /** Where the reflection lands on the screen (client px), each frame. */
  onContact?: (x: number, y: number) => void;
  /** The pond's surface, when it is there to read (the naming pond registers it). */
  surface?: PondSurfaceShare | null;
}

/** What the naming pond lends a reflection: its surface GLSL, its uniforms and camera, its canvas. */
export interface PondSurfaceShare {
  glsl: string;
  uniforms: Record<string, THREE.IUniform>;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
}

/* The reflection's own layers: drawn into its target, blurred, and laid under the vessel. */
const REFLECT_SHEET_LAYER = 3;
const REFLECT_GLASS_LAYER = 4;

const mirrorUp = new THREE.Vector3();
const mirrorDown = new THREE.Vector3();
const mirrorFoot = new THREE.Vector3();
const mirrorPlane = new THREE.Vector3();
const mirrorScratch = new THREE.Vector3();

/** The vertex furthest along `dir` (a unit vector). */
function supportToward(positions: ArrayLike<number>, dir: THREE.Vector3, out: THREE.Vector3) {
  let best = -Infinity;
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const d = positions[i] * dir.x + positions[i + 1] * dir.y + positions[i + 2] * dir.z;
    if (d > best) { best = d; x = positions[i]; y = positions[i + 1]; z = positions[i + 2]; }
  }
  return out.set(x, y, z);
}

/** Reflect through the plane through `p` with unit normal `n` (the side `n` points to stays put). */
function reflectionMatrix(m: THREE.Matrix4, p: THREE.Vector3, n: THREE.Vector3) {
  const nx = n.x, ny = n.y, nz = n.z;
  const t = 2 * (nx * p.x + ny * p.y + nz * p.z);
  return m.set(
    1 - 2 * nx * nx, -2 * nx * ny, -2 * nx * nz, t * nx,
    -2 * ny * nx, 1 - 2 * ny * ny, -2 * ny * nz, t * ny,
    -2 * nz * nx, -2 * nz * ny, 1 - 2 * nz * nz, t * nz,
    0, 0, 0, 1,
  );
}

interface Built { glass: Glass; sheet: Sheet; distance: number; radius: number }

/* The mirror laid on the lake. Each pixel finds the water under it through
   the pond's own camera, takes the pond's wave normal there (same clock, same
   rings), bends the reflection by that slope and weighs it by the water's
   Fresnel. Premultiplied in and out, as the blur passes are. */
function waterReflectFragment(surfaceGlsl: string) {
  return /* glsl */ `
  ${surfaceGlsl}
  uniform sampler2D tScene;   // the mirror, softened
  uniform sampler2D tSharp;   // the mirror as drawn
  uniform vec3 uContact;      // landing span (uv), sharpness, strength
  uniform float uWaterline;
  uniform mat4 uPondProjInv;
  uniform mat4 uPondWorld;
  uniform vec3 uPondEye;
  uniform vec4 uCanvasRect;   // this canvas on the pond's canvas: left, top, width, height (px of the pond's canvas)
  uniform vec2 uPondSize;     // the pond's canvas (css px)
  uniform vec4 uWater;        // ripple (uv per radian of slope, down the canvas), stretch, fresnel, canvas height / width
  uniform vec3 uWaterColor;
  uniform vec2 uTone;         // tint, darken
  varying vec2 vUv;
  void main() {
    // no early return before the surface: it takes derivatives (fwidth), which need every pixel in step
    float below = uWaterline - vUv.y;
    vec2 css = vec2(uCanvasRect.x + vUv.x * uCanvasRect.z, uCanvasRect.y + (1.0 - vUv.y) * uCanvasRect.w);
    vec2 ndc = vec2(css.x / uPondSize.x * 2.0 - 1.0, 1.0 - css.y / uPondSize.y * 2.0);
    vec4 a = uPondProjInv * vec4(ndc, -1.0, 1.0);
    vec4 b = uPondProjInv * vec4(ndc, 1.0, 1.0);
    vec3 wa = (uPondWorld * vec4(a.xyz / a.w, 1.0)).xyz;
    vec3 wb = (uPondWorld * vec4(b.xyz / b.w, 1.0)).xyz;
    vec3 dir = wb - wa;
    // above the pond's horizon there is no water to hold it
    float onWater = step(dir.y, -1e-6) * step(0.0, below);
    vec3 P = wa + dir * (-wa.y / min(dir.y, -1e-6));
    vec2 flow;
    vec3 n = pondSurfaceNormal(P.xz, flow);
    vec3 e = normalize(uPondEye - P);
    float F = .02 + .98 * pow(1.0 - max(0.0, dot(n, e)), 5.0);
    // a slope tilts the reflected ray by twice itself: across, and (foreshortened) down
    // the landing: just under the waterline the reflection falls clear — unbent, unblurred, strong
    float landing = 1.0 - smoothstep(0.0, max(.001, uContact.x), below);
    landing *= landing;
    vec2 bend = vec2(n.x, n.z) * 2.0 * uWater.x * vec2(uWater.w, uWater.y) * (1.0 - landing * uContact.y);
    vec2 uv = vUv + bend;
    uv.y = min(uv.y, uWaterline);
    vec4 c = mix(texture2D(tScene, uv), texture2D(tSharp, uv), landing * uContact.y);
    c.rgb = mix(c.rgb, uWaterColor * c.a, uTone.x * (1.0 - landing * .6)) * (1.0 - uTone.y);
    float weight = max(mix(1.0, smoothstep(0.0, .55, F), uWater.z), landing * uContact.z);
    gl_FragColor = c * weight * onWater * smoothstep(0.0, .006, below);
  }
`;
}

interface Soften {
  frame: THREE.WebGLRenderTarget;
  pong: THREE.WebGLRenderTarget;
  /** The softened mirror, beside the sharp one (the lake reads both). */
  soft?: THREE.WebGLRenderTarget;
  blur: THREE.ShaderMaterial;
  quad: THREE.Mesh;
  scene: THREE.Scene;
  ortho: THREE.OrthographicCamera;
}
const waterColor = new THREE.Color();
const waterline = new THREE.Vector3();

/** One separable pass of the lab's 13-tap kernel onto the screen. σ is in device pixels. */
function spreadSoft(renderer: THREE.WebGLRenderer, s: Soften, sigma: number) {
  const tap = sigma / 2.5;
  const blur = s.blur;
  blur.uniforms.tScene.value = s.frame.texture;
  (blur.uniforms.uStep.value as THREE.Vector2).set(tap / Math.max(1, s.frame.width), 0);
  s.quad.material = blur;
  renderer.setRenderTarget(s.pong);
  renderer.render(s.scene, s.ortho);
  blur.uniforms.tScene.value = s.pong.texture;
  (blur.uniforms.uStep.value as THREE.Vector2).set(0, tap / Math.max(1, s.frame.height));
  renderer.setRenderTarget(null);
  renderer.render(s.scene, s.ortho);
}

/* ───────── the photos, shared by every seat that shows one ─────────
   One texture per URL for the visit: a seat that mounts, leaves and comes
   back (the field keeps all ten mounted, but the editor replaces the gallery)
   does not fetch and decode its picture again, and the ten canvases share the
   decoded image — each renderer uploads it once to its own context. The
   preview preloads its set as it mounts, so by the time the dive has settled
   the pictures are in the stock and nothing develops late. */
export interface SeatPhoto { texture: THREE.Texture; aspect: number }
const photos = new Map<string, SeatPhoto>();
const photosLoading = new Map<string, Promise<SeatPhoto>>();
/** The longest side a seat's picture is kept at. The studio raises it for its exports;
    pictures already in the stock keep the size they were loaded at. */
let seatPhotoMax = SEAT_PHOTO_MAX;
export function setSeatPhotoMax(px: number) { seatPhotoMax = px; }

export function loadSeatPhoto(url: string): Promise<SeatPhoto> {
  const have = photos.get(url);
  if (have) return Promise.resolve(have);
  let pending = photosLoading.get(url);
  if (!pending) {
    pending = photoLoader.loadAsync(url).then((t) => {
      // every seat's context holds its own copy: no larger than the seat can show
      (t as THREE.Texture<HTMLImageElement | HTMLCanvasElement>).image = scaledImage(t.image as HTMLImageElement, seatPhotoMax);
      const image = t.image as { width: number; height: number };
      const photo = { texture: prepareFilmPhoto(t), aspect: image.width / image.height };
      photos.set(url, photo);
      photosLoading.delete(url);
      return photo;
    }, (err) => { photosLoading.delete(url); throw err; });
    photosLoading.set(url, pending);
  }
  return pending;
}
/** The photo if it has already arrived. */
export function peekSeatPhoto(url: string): SeatPhoto | undefined {
  return photos.get(url);
}
export function preloadSeatPhotos(urls: string[]) {
  for (const url of urls) loadSeatPhoto(url).catch(() => undefined);
}

const canvasScales = new Map<string, number>();

/** How much this form's gallery canvas grows so its furthest point stays in frame. */
export function vesselCanvasScale(form: ArtifactForm, morph: number): number {
  const key = `${formKey(form)}|${morph}`;
  const hit = canvasScales.get(key);
  if (hit !== undefined) return hit;
  const glass = buildGlass(form, morph);
  const scale = frameVessel(glass.positions, LOOK_Y, FOV).canvasScale;
  glass.geometry.dispose();
  canvasScales.set(key, scale);
  return scale;
}

function VesselObject({
  parts, photoUrl, seed, tune, room, glassMode = "refract", sheetMode = "draped", face = "inside", focused, still, rest, cacheKey, facing, viewPitch, viewToken, locked = false, holdView = false, onView, onPick, onReady, blurPx = 0, maxViewportWidth, reflection, sheen, capture,
}: VesselArtifactProps & { parts: VesselParts }) {
  const { camera, gl, scene, size, invalidate } = useThree();
  // the film panel (lib/filmTune.ts) re-renders the seat, which rewrites its photo's look
  const film = useFilmTune();
  const canvasDpr = useThree((st) => st.viewport.dpr);
  const mirror = reflection && reflection.strength > 0 ? reflection : null;
  // the canvas reaches below the seat by this share of its height; the seat itself is the top of it
  const extra = mirror ? Math.max(0, mirror.room) : 0;
  const seatH = size.height / (1 + extra);
  // opens with the eye on the sheet's side of the wall, so the picture faces the viewer squarely;
  // the pressed sheet has no one place, so it opens at a turn of its own
  const faceAngle = facing ?? tune.anchorAngle;
  const yaw = useRef(sheetMode === "draped" ? (-faceAngle * Math.PI) / 180 : hash2(seed, 3.1) * Math.PI * 2);
  const pitch = useRef(viewPitch ?? tune.pitch);
  const faceSeen = useRef(faceAngle);
  const tokenSeen = useRef(viewToken);
  if (tokenSeen.current !== viewToken) {
    yaw.current = (-faceAngle * Math.PI) / 180;
    pitch.current = viewPitch ?? tune.pitch;
    tokenSeen.current = viewToken;
    faceSeen.current = faceAngle;
  } else if (faceSeen.current !== faceAngle) {
    // the eye's side moved: it goes round with it, keeping any turn of the viewer's own
    if (sheetMode === "draped") yaw.current -= ((faceAngle - faceSeen.current) * Math.PI) / 180;
    faceSeen.current = faceAngle;
  }
  const extraRef = useRef(extra);
  extraRef.current = extra;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const holdViewRef = useRef(holdView);
  holdViewRef.current = holdView;
  const onViewRef = useRef(onView);
  onViewRef.current = onView;

  // at the apex the vessel is in hand: a drag turns the eye round it and up or down, as in the lab
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  // a mouse resting on the vessel at the apex: it floats and turns, unless a drag has it in hand
  const hover = useRef({ over: false, held: false, amount: 0, phase: 0 });
  const body = useRef<THREE.Mesh>(null);
  const mirrorGroup = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!focused) {
      hover.current.over = false;
      hover.current.held = false;
      setApexHover(false);
      return;
    }
    const el = gl.domElement;
    let last: { id: number; x: number; y: number } | null = null;
    let travelled = 0;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const setOver = (next: boolean) => {
      hover.current.over = next;
      setApexHover(next);
      if (next) invalidate();
    };
    // the glass itself, not the square canvas it is drawn in
    const hitBody = (e: PointerEvent) => {
      if (!body.current) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObject(body.current, false).length > 0;
    };
    const enter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || last) return;
      setOver(hitBody(e));
    };
    const leave = () => { if (!last) setOver(false); };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      // the room under the seat holds only the reflection: a press there is not a press on the vessel
      const r = el.getBoundingClientRect();
      if (e.clientY > r.top + r.height / (1 + extraRef.current)) return;
      last = { id: e.pointerId, x: e.clientX, y: e.clientY };
      hover.current.held = true;
      travelled = 0;
      try { el.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer holds */ }
      if (!lockedRef.current) el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      if (!last || e.pointerId !== last.id) return;
      travelled += Math.hypot(e.clientX - last.x, e.clientY - last.y);
      if (!lockedRef.current) {
        yaw.current += (e.clientX - last.x) * 0.01;
        // drag down tips the crown down (the eye rises). The lab's drag is the other way.
        pitch.current = Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitch.current + (e.clientY - last.y) * 0.25));
        onViewRef.current?.((-yaw.current * 180) / Math.PI, pitch.current);
        invalidate();
      }
      last = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (!last || e.pointerId !== last.id) return;
      last = null;
      hover.current.held = false;
      el.style.cursor = lockedRef.current ? "" : "grab";
      if (e.pointerType === "mouse") setOver(hitBody(e));
      if (e.type === "pointerup" && travelled < 6) onPickRef.current?.();
    };
    el.style.cursor = locked ? "" : "grab";
    el.style.touchAction = "none";
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointermove", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.style.cursor = "";
      el.style.touchAction = "";
      hover.current.over = false;
      hover.current.held = false;
      setApexHover(false);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointermove", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [focused, gl, camera, invalidate, locked]);
  useEffect(() => { invalidate(); }, [viewToken, invalidate]);

  const pass = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { samples: RT_SAMPLES, depthBuffer: true, stencilBuffer: false });
    const blit = new THREE.ShaderMaterial({
      vertexShader: backdropVertex, fragmentShader: blitFragment,
      uniforms: { tScene: { value: target.texture } },
      depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blit);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { target, blit, quad, scene, ortho };
  }, []);
  useEffect(() => () => { pass.target.dispose(); pass.blit.dispose(); pass.quad.geometry.dispose(); }, [pass]);
  // The seat's depth softness. A CSS blur of this transparent canvas fringes in
  // Safari, so a neighbour is softened here, in the same pixels both browsers
  // composite. The apex stays sharp and never allocates the extra targets.
  const blurLive = useRef(blurPx);
  blurLive.current = seatBlurPx.get(cacheKey) ?? blurPx;
  const soften = useRef<Soften | null>(null);
  useEffect(() => () => {
    const s = soften.current;
    if (!s) return;
    s.frame.dispose();
    s.pong.dispose();
    s.blur.dispose();
    s.quad.geometry.dispose();
  }, []);
  // the reflection's targets, made only once a reflection is asked for
  const mirrorPass = useRef<Soften | null>(null);
  useEffect(() => () => {
    const m = mirrorPass.current;
    if (!m) return;
    m.frame.dispose();
    m.pong.dispose();
    m.soft?.dispose();
    m.blur.dispose();
    m.quad.geometry.dispose();
    waterPass.current?.material.dispose();
  }, []);
  // the lake pass: built once the pond lends its surface, rebuilt if that changes
  const waterPass = useRef<{ glsl: string; material: THREE.ShaderMaterial } | null>(null);
  const ensureWater = (share: PondSurfaceShare) => {
    const have = waterPass.current;
    if (have && have.glsl === share.glsl) return have.material;
    have?.material.dispose();
    const material = new THREE.ShaderMaterial({
      vertexShader: backdropVertex, fragmentShader: waterReflectFragment(share.glsl),
      uniforms: {
        ...share.uniforms,
        tScene: { value: null }, tSharp: { value: null }, uContact: { value: new THREE.Vector3() }, uWaterline: { value: 0 },
        uPondProjInv: { value: share.camera.projectionMatrixInverse },
        uPondWorld: { value: share.camera.matrixWorld },
        uPondEye: { value: share.camera.position },
        uCanvasRect: { value: new THREE.Vector4() }, uPondSize: { value: new THREE.Vector2(1, 1) },
        uWater: { value: new THREE.Vector4() }, uWaterColor: { value: new THREE.Color() }, uTone: { value: new THREE.Vector2() },
      },
      depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    waterPass.current = { glsl: share.glsl, material };
    return material;
  };
  const ensureMirror = () => {
    if (mirrorPass.current) return mirrorPass.current;
    const frame = new THREE.WebGLRenderTarget(1, 1, { samples: RT_SAMPLES, depthBuffer: true, stencilBuffer: false });
    const pong = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
    const blur = new THREE.ShaderMaterial({
      vertexShader: backdropVertex, fragmentShader: blurFragment,
      uniforms: { tScene: { value: frame.texture }, uStep: { value: new THREE.Vector2() } },
      depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blur);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    mirrorPass.current = { frame, pong, blur, quad, scene, ortho };
    return mirrorPass.current;
  };
  const ensureSoften = () => {
    if (soften.current) return soften.current;
    const frame = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false });
    const pong = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
    const blur = new THREE.ShaderMaterial({
      vertexShader: backdropVertex, fragmentShader: blurFragment,
      uniforms: { tScene: { value: frame.texture }, uStep: { value: new THREE.Vector2() } },
      depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blur);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    soften.current = { frame, pong, blur, quad, scene, ortho };
    return soften.current;
  };
  useEffect(() => {
    const dpr = gl.getPixelRatio();
    const w = Math.max(1, Math.round(size.width * dpr));
    const h = Math.max(1, Math.round(size.height * dpr));
    pass.target.setSize(w, h);
    const s = soften.current;
    if (s) { s.frame.setSize(w, h); s.pong.setSize(w, h); }
    invalidate();
  }, [pass, gl, size, canvasDpr, invalidate]);

  const framing = useMemo(() => frameVessel(parts.glass.positions, LOOK_Y, FOV), [parts]);
  const built = useMemo<Built>(() => ({
    ...parts,
    radius: framing.radius,
    distance: cappedVesselDistance(framing, FOV, size.width / Math.max(1, seatH), maxViewportWidth, HOVER_BOB),
  }), [parts, framing, size.width, seatH, maxViewportWidth]);
  useEffect(() => {
    // Large library multipliers may require a longer orbit than the old far plane.
    const view = camera as THREE.PerspectiveCamera;
    view.far = Math.max(50, built.distance * (1 + HOVER_BOB) + built.radius * 2);
    view.updateProjectionMatrix();
    invalidate();
  }, [camera, built.distance, built.radius, invalidate]);
  const edgePrint = useMemo(() => createEdgePrint(1 + Math.floor(hash2(seed, 7.7) * 36)), [seed]);
  useEffect(() => () => edgePrint.dispose(), [edgePrint]);
  const key = keyFrom(tune.keyAzimuth, tune.keyElevation);
  const patches = useMemo(() => seedDirections(seed, 3, 1.1), [seed]);
  const sheetU = useMemo(() => createSheetUniformSet(edgePrint), [edgePrint]);
  const glassU = useMemo(() => createGlassUniformSet(pass.target.texture), [pass]);
  const groundY = built.glass.lo - 0.02;
  // the air a receded memory fades toward: the room, as the lab's backdrop would show it
  const air = airFor(tune, glassMode, room);
  writeSheetUniforms(sheetU, { tune, seed, sheet: built.sheet, sheetMode, face, key, edgePrint, groundY, reflect: -1, air });
  writeGlassUniforms(glassU, { tune, seed, key, patches, room, groundY, reflect: -1, air, span: built.glass });
  writeSheen(glassU, sheen);
  // the mirrored copy: the same materials, fading with depth under the mirror
  const mirrorY = built.glass.lo - (mirror?.gap ?? 0.02);
  const sheetM = useMemo(() => createSheetUniformSet(edgePrint), [edgePrint]);
  const glassM = useMemo(() => createGlassUniformSet(pass.target.texture), [pass]);
  if (mirror) {
    writeSheetUniforms(sheetM, { tune, seed, sheet: built.sheet, sheetMode, face, key, edgePrint, groundY: mirrorY, reflect: mirror.strength, air });
    writeGlassUniforms(glassM, { tune, seed, key, patches, room, groundY: mirrorY, reflect: mirror.strength, air, span: built.glass });
    sheetM.uReflectFall.value = glassM.uReflectFall.value = Math.max(0.05, mirror.fall);
    writeSheen(glassM, sheen);
    sheetM.uPhoto.value = sheetU.uPhoto.value;
    sheetM.uImageAspect.value = sheetU.uImageAspect.value;
  }
  // a parked seat draws on demand. A new tune or room (the gallery's dev panel)
  // asks for a frame, and so does arriving at a resting offset: the row holds
  // the last frame while it moves, then draws the blur of the seat it stopped
  // on. The pixel ratio too — leaving the apex resizes the buffer, which clears it.
  useEffect(() => { invalidate(); }, [tune, room, reflection, sheen, film, rest, canvasDpr, invalidate]);

  // the picture, from the shared stock: already there if it was preloaded, else set as it arrives
  const photo = photoUrl ? peekSeatPhoto(photoUrl) : undefined;
  const photoReady = useRef(!photoUrl || !!photo);
  sheetU.uPhoto.value = photo?.texture ?? BLANK_PHOTO;
  sheetU.uImageAspect.value = photo?.aspect ?? 1.5;
  useEffect(() => {
    if (!photoUrl || photo) return;
    let live = true;
    loadSeatPhoto(photoUrl).then((p) => {
      if (!live) return;
      photoReady.current = true;
      sheetU.uPhoto.value = sheetM.uPhoto.value = p.texture;
      sheetU.uImageAspect.value = sheetM.uImageAspect.value = p.aspect;
      invalidate();
    }).catch(() => { if (live) { photoReady.current = true; invalidate(); } });
    return () => { live = false; };
  }, [photoUrl, photo, sheetU, sheetM, invalidate]);

  /* The shaders are compiled off the frame before anything is drawn: ten
     seats mounting together used to compile on the same first frame, a long
     one, with each canvas showing whatever half of it had been linked. Until
     this resolves the canvas stays clear, which the arrival's fade covers. */
  // a ref, not state: the frame the invalidate asks for can run before React would commit a state change
  const compiledFor = useRef<GlassMode | null>(null);
  useEffect(() => {
    let live = true;
    camera.layers.enableAll();
    Promise.all([gl.compileAsync(scene, camera), gl.compileAsync(pass.scene, pass.ortho)])
      .catch(() => undefined)
      .then(() => { if (live) { compiledFor.current = glassMode; invalidate(); } });
    return () => { live = false; };
  }, [gl, scene, camera, pass, glassMode, invalidate]);

  const didRender = useRef(false);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const reportReady = () => {
    if (!didRender.current && photoReady.current) {
      didRender.current = true;
      // what reads the frame (the landing's ink outlines) takes only the seat, not the room under it
      gl.domElement.dataset.seatShare = String(1 / (1 + extra));
      readyRef.current?.(gl.domElement);
    }
  };
  const refract = glassMode === "refract";
  // a capture waits for a frame that has its reflection (the first is drawn without it)
  const deliver = (first: boolean) => {
    const take = capture?.current;
    if (!take || !didRender.current || (first && mirror)) return;
    capture.current = null;
    const copy = document.createElement("canvas");
    copy.width = gl.domElement.width; copy.height = gl.domElement.height;
    copy.getContext("2d")?.drawImage(gl.domElement, 0, 0);
    take(copy);
  };
  // the catches of light and the sheen. A still seat holds its frame, so this
  // only moves while the seat is actually drawing. Waking it continues from
  // the angle it held: taking the wall clock would swing the light there in
  // one frame, which is the jump as a vessel reaches the centre.
  const lightTime = useRef(0);
  useFrame(({ gl: renderer, scene, camera: view }, dt) => {
    blurLive.current = seatBlurPx.get(cacheKey) ?? blurPx;
    if (compiledFor.current !== glassMode) return;
    const step = Math.min(dt, 0.1);
    if (focused && !still) yaw.current += tune.turn * step;
    const h = hover.current;
    const want = focused && h.over && !h.held && !reducedMotion ? 1 : 0;
    h.amount += (want - h.amount) * (1 - Math.exp(-step / HOVER_EASE_S));
    if (h.amount > 1e-3) {
      h.phase += step * (2 * Math.PI / HOVER_BOB_S);
      if (!lockedRef.current && !holdViewRef.current) yaw.current -= HOVER_SPIN * h.amount * step;
      invalidate();
    }
    if (!reducedMotion) lightTime.current += step;
    const shown = reducedMotion ? 0 : lightTime.current;
    glassU.uTime.value = glassM.uTime.value = shown;
    glassU.uSheenTime.value = glassM.uSheenTime.value = shown;
    const y = yaw.current, p = (pitch.current * Math.PI) / 180, d = built.distance;
    const bob = HOVER_BOB * d * h.amount * Math.sin(h.phase);
    camera.position.set(-Math.sin(y) * Math.cos(p) * d, LOOK_Y - bob + Math.sin(p) * d, Math.cos(y) * Math.cos(p) * d);
    camera.lookAt(0, LOOK_Y - bob, 0);
    // the seat is the top of a taller canvas: the lens keeps the seat's framing and the canvas shows on below it
    const lens = camera as THREE.PerspectiveCamera;
    if (extra > 0) {
      lens.aspect = size.width / Math.max(1, seatH);
      lens.setViewOffset(size.width, seatH, 0, 0, size.width, size.height);
    } else if (lens.view?.enabled) {
      lens.aspect = size.width / Math.max(1, size.height);
      lens.clearViewOffset();
    }
    lens.updateProjectionMatrix();
    // The gallery's mirror stays on the ground of the view: the plane's normal
    // is the screen's up, through whatever part of the vessel is lowest there.
    // Orbiting the eye used to mirror through world down, so the reflection
    // swung with the vessel's own axis and, from above, hid under it.
    // The lake is a level plane and keeps that mirror.
    const mirrored = mirrorGroup.current;
    if (mirrored && mirror) {
      if (mirror.water) {
        mirrorUp.set(0, 1, 0);
        mirrorPlane.set(0, mirrorY, 0);
      } else {
        mirrorUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
        mirrorDown.copy(mirrorUp).negate();
        supportToward(built.glass.positions, mirrorDown, mirrorFoot);
        const sheetPos = built.sheet.geometry.getAttribute("position").array as ArrayLike<number>;
        supportToward(sheetPos, mirrorDown, mirrorScratch);
        if (mirrorScratch.dot(mirrorDown) > mirrorFoot.dot(mirrorDown)) mirrorFoot.copy(mirrorScratch);
        mirrorPlane.copy(mirrorFoot).addScaledVector(mirrorUp, -mirror.gap);
        const level = mirrorUp.dot(mirrorPlane);
        sheetM.uGroundN.value.copy(mirrorUp);
        glassM.uGroundN.value.copy(mirrorUp);
        sheetM.uGroundY.value = glassM.uGroundY.value = level;
      }
      reflectionMatrix(mirrored.matrix, mirrorPlane, mirrorUp);
      mirrored.matrixWorldNeedsUpdate = true;
    }
    // CSS blur()'s argument is the Gaussian deviation, in the canvas's own
    // pixels (the seat scales afterwards). The 13-tap kernel is σ = 2.5 taps.
    const sigma = blurLive.current * renderer.getPixelRatio();
    const s = sigma > 0.35 ? ensureSoften() : null;
    if (s && (s.frame.width !== pass.target.width || s.frame.height !== pass.target.height)) {
      s.frame.setSize(pass.target.width, pass.target.height);
      s.pong.setSize(pass.target.width, pass.target.height);
    }
    const out = s ? s.frame : null;
    if (!refract) {
      view.layers.enableAll();
      renderer.setRenderTarget(out);
      renderer.render(scene, view);
      renderer.setRenderTarget(null);
      if (s) spreadSoft(renderer, s, sigma);
      const firstFrost = !didRender.current;
      reportReady();
      deliver(firstFrost);
      return;
    }
    glassU.uResolution.value.set(pass.target.width, pass.target.height);
    glassM.uResolution.value.set(pass.target.width, pass.target.height);
    // the first frame, which the gallery keeps as the vessel's outline, is drawn without the reflection
    const m = mirror && didRender.current ? ensureMirror() : null;
    if (m) {
      if (m.frame.width !== pass.target.width || m.frame.height !== pass.target.height) {
        m.frame.setSize(pass.target.width, pass.target.height);
        m.pong.setSize(pass.target.width, pass.target.height);
      }
      // the mirrored strip, then the mirrored glass refracting it, into the reflection's target
      view.layers.set(REFLECT_SHEET_LAYER);
      renderer.setRenderTarget(pass.target);
      renderer.render(scene, view);
      renderer.setRenderTarget(m.frame);
      renderer.render(pass.scene, pass.ortho);
      renderer.clearDepth();
      view.layers.set(REFLECT_GLASS_LAYER);
      renderer.autoClear = false;
      renderer.render(scene, view);
      renderer.autoClear = true;
      // softened, across and back down into its own target
      const mSigma = mirror.soft * renderer.getPixelRatio();
      const w = mirror.water;
      const share = w?.surface;
      if (w && share) {
        // on the lake: blurred (longer down than across) beside the sharp mirror, then laid on the water
        let softTex = m.frame.texture;
        if (mSigma > 0.35) {
          if (!m.soft) m.soft = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
          if (m.soft.width !== m.frame.width || m.soft.height !== m.frame.height) m.soft.setSize(m.frame.width, m.frame.height);
          m.blur.uniforms.tScene.value = m.frame.texture;
          (m.blur.uniforms.uStep.value as THREE.Vector2).set(mSigma / 2.5 / Math.max(1, m.frame.width), 0);
          renderer.setRenderTarget(m.pong);
          renderer.render(m.scene, m.ortho);
          m.blur.uniforms.tScene.value = m.pong.texture;
          (m.blur.uniforms.uStep.value as THREE.Vector2).set(0, (mSigma * (1 + Math.max(0, w.smear))) / 2.5 / Math.max(1, m.frame.height));
          renderer.setRenderTarget(m.soft);
          renderer.render(m.scene, m.ortho);
          softTex = m.soft.texture;
        }
        const water = ensureWater(share);
        const u = water.uniforms;
        // the waterline on this canvas: the mirror plane under the vessel's axis
        waterline.set(0, mirrorY, 0).project(view);
        u.tScene.value = softTex;
        u.tSharp.value = m.frame.texture;
        (u.uContact.value as THREE.Vector3).set(w.contact, w.contactSharp, w.contactStrength);
        u.uWaterline.value = waterline.y * 0.5 + 0.5;
        // where this canvas lies on the pond's (both are measured as laid out, transforms and all)
        const mine = renderer.domElement.getBoundingClientRect();
        const pond = share.canvas.getBoundingClientRect();
        // where it lands, for the lake's spot of colour
        w.onContact?.(mine.left + mine.width * (waterline.x * 0.5 + 0.5), mine.top + mine.height * (0.5 - waterline.y * 0.5));
        (u.uCanvasRect.value as THREE.Vector4).set(mine.left - pond.left, mine.top - pond.top, mine.width, mine.height);
        (u.uPondSize.value as THREE.Vector2).set(Math.max(1, pond.width), Math.max(1, pond.height));
        // a radian of slope, in this canvas's uv down its height: the pond's lens spans its height in fov
        const pondFov = (share.camera.fov * Math.PI) / 180 / Math.max(1e-3, share.camera.zoom);
        const perRadian = (pond.height / Math.max(1, mine.height)) / pondFov;
        (u.uWater.value as THREE.Vector4).set(w.ripple * perRadian, w.stretch, w.fresnel, mine.height / Math.max(1, mine.width));
        (u.uWaterColor.value as THREE.Color).copy(waterColor.set(w.color));
        (u.uTone.value as THREE.Vector2).set(w.tint, w.darken);
        m.quad.material = water;
        renderer.setRenderTarget(pass.target);
        renderer.render(m.scene, m.ortho);
        m.quad.material = m.blur;
      } else if (mSigma > 0.35) {
        const tap = mSigma / 2.5;
        m.blur.uniforms.tScene.value = m.frame.texture;
        (m.blur.uniforms.uStep.value as THREE.Vector2).set(tap / Math.max(1, m.frame.width), 0);
        renderer.setRenderTarget(m.pong);
        renderer.render(m.scene, m.ortho);
        m.blur.uniforms.tScene.value = m.pong.texture;
        (m.blur.uniforms.uStep.value as THREE.Vector2).set(0, tap / Math.max(1, m.frame.height));
        renderer.setRenderTarget(pass.target);
        renderer.render(m.scene, m.ortho);
      } else {
        pass.blit.uniforms.tScene.value = m.frame.texture;
        renderer.setRenderTarget(pass.target);
        renderer.render(pass.scene, pass.ortho);
        pass.blit.uniforms.tScene.value = pass.target.texture;
      }
      // the vessel's strip over it: the facing glass then refracts the reflection with the rest
      renderer.clearDepth();
      view.layers.set(0);
      renderer.autoClear = false;
      renderer.render(scene, view);
      renderer.autoClear = true;
    } else {
      view.layers.set(0);
      renderer.setRenderTarget(pass.target);
      renderer.render(scene, view);
    }
    renderer.setRenderTarget(out);
    renderer.render(pass.scene, pass.ortho);
    renderer.clearDepth();
    view.layers.set(FRONT_LAYER);
    renderer.autoClear = false;
    renderer.render(scene, view);
    renderer.autoClear = true;
    view.layers.enableAll();
    if (s) spreadSoft(renderer, s, sigma);
    const first = !didRender.current;
    reportReady();
    // the outline has been kept: the next frame brings the reflection in
    if (first && didRender.current && mirror) invalidate();
    deliver(first);
  }, 1);

  return <>
    <mesh geometry={built.glass.geometry} renderOrder={0} frustumCulled={false} layers={refract ? FRONT_LAYER : 0}>
      <shaderMaterial key={glassMode} transparent depthWrite={false} side={THREE.BackSide}
        vertexShader={glassVertex} fragmentShader={refract ? glassRefractFragment : glassFragment} uniforms={glassU} />
    </mesh>
    <mesh geometry={built.sheet.geometry} renderOrder={1} frustumCulled={false}>
      <shaderMaterial transparent depthWrite={false} side={THREE.DoubleSide}
        vertexShader={sheetVertex} fragmentShader={sheetFragment} uniforms={sheetU} />
    </mesh>
    <mesh geometry={built.glass.geometry} renderOrder={2} frustumCulled={false} layers={refract ? FRONT_LAYER : 0}>
      <shaderMaterial key={glassMode} transparent depthWrite={false} side={THREE.FrontSide}
        vertexShader={glassVertex} fragmentShader={refract ? glassRefractFragment : glassFragment} uniforms={glassU} />
    </mesh>
    <mesh ref={body} geometry={built.glass.geometry} visible={false} frustumCulled={false} />
    {/* the distance's mist, as the editor shows it (the editor's post blur is the lab's own and is not drawn here) */}
    <Mist geometry={built.glass.geometry} uniforms={glassU} layer={refract ? FRONT_LAYER : 0} renderOrder={3} on={tune.haze * (tune.hazeMist + tune.hazeGlow) > 0} />
    {/* the reflection, on its own layers (refraction only). The plane is set each frame:
        the view's ground for the gallery, the level waterline for the lake. */}
    {mirror && refract && <group ref={mirrorGroup} matrixAutoUpdate={false}>
      <mesh geometry={built.glass.geometry} renderOrder={0} frustumCulled={false} layers={REFLECT_GLASS_LAYER}>
        <shaderMaterial transparent depthWrite={false} side={THREE.BackSide}
          vertexShader={glassVertex} fragmentShader={glassRefractFragment} uniforms={glassM} />
      </mesh>
      <mesh geometry={built.sheet.geometry} renderOrder={1} frustumCulled={false} layers={REFLECT_SHEET_LAYER}>
        <shaderMaterial transparent depthWrite={false} side={THREE.DoubleSide}
          vertexShader={sheetVertex} fragmentShader={sheetFragment} uniforms={sheetM} />
      </mesh>
      <mesh geometry={built.glass.geometry} renderOrder={2} frustumCulled={false} layers={REFLECT_GLASS_LAYER}>
        <shaderMaterial transparent depthWrite={false} side={THREE.FrontSide}
          vertexShader={glassVertex} fragmentShader={glassRefractFragment} uniforms={glassM} />
      </mesh>
    </group>}
  </>;
}

/** Live softness for a gallery seat, written each frame by the gallery and read
    in the draw. Keeping it off the React props means a moving rim does not
    re-render every canvas (each re-render walks that canvas's layout effects). */
const seatBlurPx = new Map<string, number>();

export function setSeatBlur(cacheKey: string, px: number) {
  seatBlurPx.set(cacheKey, px);
}

/** One new WebGL context per frame, nearest seat first. Enter used to create
 *  every gallery context in the click's own turn. */
const canvasWaiters: { priority: number; order: number; run: () => void; cancelled: boolean }[] = [];
let canvasWaiterOrder = 0;
let canvasPumping = false;
function pumpCanvasMounts() {
  if (canvasPumping) return;
  canvasPumping = true;
  requestAnimationFrame(() => {
    canvasPumping = false;
    while (canvasWaiters.length && canvasWaiters[0].cancelled) canvasWaiters.shift();
    const next = canvasWaiters.shift();
    if (!next) return;
    if (!next.cancelled) next.run();
    if (canvasWaiters.some((waiter) => !waiter.cancelled)) pumpCanvasMounts();
  });
}
function scheduleCanvasMount(priority: number, run: () => void): () => void {
  const waiter = { priority, order: canvasWaiterOrder++, run, cancelled: false };
  canvasWaiters.push(waiter);
  canvasWaiters.sort((a, b) => a.priority - b.priority || a.order - b.order);
  pumpCanvasMounts();
  return () => { waiter.cancelled = true; };
}

/** How far past MAX_DPR a stretched seat may render (desktop 2 → 3.5; a phone's 1.75 → 2.45). */
const SEAT_DPR_HEADROOM = LIGHT_TIER ? 1.4 : 1.75;

/** The canvas's pixel ratio: the screen's (to MAX_DPR), times the seat's on-screen stretch. */
function seatDpr(pixelScale: number | undefined): number | [number, number] {
  if (!pixelScale || pixelScale <= 1.001) return [1, MAX_DPR];
  const screen = Math.min(MAX_DPR, Math.max(1, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1));
  return Math.min(screen * pixelScale, MAX_DPR * SEAT_DPR_HEADROOM);
}

export function VesselArtifact(props: VesselArtifactProps) {
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const mounted = useRef(false);
  // A real unmount releases the context before the next frame, so a scrolling
  // rim stays under the browser's limit. The check after a microtask skips the
  // development double-invoke, which replays this cleanup without unmounting
  // the canvas. dispose() drops Three's listener first, so a seat we closed
  // on purpose is not reported as "Context Lost".
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const gl = glRef.current;
      queueMicrotask(() => {
        if (mounted.current || !gl) return;
        glRef.current = null;
        gl.dispose();
        gl.forceContextLoss();
      });
    };
  }, []);
  // the canvas waits for its glass and cloth: the queue builds them a memory at a
  // time, nearest first, so neither the settle nor the context and its shaders
  // arrive for every seat on the same frame
  const parts = useVesselParts({
    form: props.form, morph: props.morph, tune: props.tune, sheetMode: props.sheetMode ?? "draped",
    seed: props.seed, sheetSize: props.sheetSize,
  }, props.priority ?? (props.focused ? 0 : 1));
  const [canvasOn, setCanvasOn] = useState(false);
  useEffect(() => {
    if (!parts) return;
    let live = true;
    const cancel = scheduleCanvasMount(props.priority ?? (props.focused ? 0 : 1), () => {
      if (live) setCanvasOn(true);
    });
    return () => { live = false; cancel(); };
    // priority orders the queue; the parts' identity is the build
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, props.priority, props.focused]);
  if (!parts || !canvasOn) return <div style={{ width: "100%", height: "100%" }} />;
  const extra = props.reflection && props.reflection.strength > 0 ? Math.max(0, props.reflection.room) : 0;
  return (
    // offsetSize: the seat is scaled by a CSS transform along the curve, and a resize observer does not see
    // transforms — measured by its bounds, a canvas first mounted far down the curve would be rendered at
    // that tiny size and stretched when it reached the apex
    <Canvas camera={{ position: [0, 0.6, 9], fov: FOV, near: 0.1, far: 50 }}
      dpr={props.dpr ?? seatDpr(props.pixelScale)} gl={{ antialias: true, alpha: true, premultipliedAlpha: true }} frameloop={props.frameloop}
      resize={{ offsetSize: true }}
      onCreated={({ gl }) => { glRef.current = gl; gl.debug.checkShaderErrors = SHADER_CHECKS; }}
      style={extra > 0 ? { width: "100%", height: `${(1 + extra) * 100}%` } : { width: "100%", height: "100%" }}>
      <VesselObject {...props} parts={parts} />
    </Canvas>
  );
}
