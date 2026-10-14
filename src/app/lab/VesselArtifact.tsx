import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { formKey, type ArtifactForm } from "../lib/superformula";
import { prepareFilmPhoto } from "../lib/filmLook";
import { SEAT_PHOTO_MAX, scaledImage } from "../lib/photoSize";
import { MAX_DPR, RT_SAMPLES } from "../lib/deviceTier";
import { setApexHover } from "../lib/apexHover";
import { useVesselParts, type VesselParts } from "./vesselBuilds";
import { createEdgePrint } from "./filmStrip";
import {
  BLANK_PHOTO, FOV, FRONT_LAYER, LOOK_Y, Mist, PITCH_MAX, PITCH_MIN, airFor, backdropVertex, blitFragment, blurFragment, buildGlass,
  createGlassUniformSet, createSheetUniformSet, glassFragment, glassRefractFragment, glassVertex, hash2,
  keyFrom, photoLoader, seedDirections, sheetFragment, sheetVertex, writeGlassUniforms, writeSheetUniforms,
  type Glass, type GlassMode, type Room, type Sheet, type SheetFace, type SheetMode, type VesselTune,
} from "./VesselPreview";

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
  /** As a drag turns the eye: the wall angle it now faces and its height, in degrees. */
  onView?: (facing: number, pitch: number) => void;
  /** Depth softness in CSS pixels of this canvas, before the seat's scale.
      Drawn here so the blur is the same pixels in Safari and Chrome. */
  blurPx?: number;
  /** A press and release without a drag at the apex — the seat is being asked for. */
  onPick?: () => void;
  /** Called after the first complete frame, so arrivals wait for the actual vessel. */
  onReady?: (canvas: HTMLCanvasElement) => void;
}

interface Built { glass: Glass; sheet: Sheet; distance: number }

interface Soften {
  frame: THREE.WebGLRenderTarget;
  pong: THREE.WebGLRenderTarget;
  blur: THREE.ShaderMaterial;
  quad: THREE.Mesh;
  scene: THREE.Scene;
  ortho: THREE.OrthographicCamera;
}

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

export function loadSeatPhoto(url: string): Promise<SeatPhoto> {
  const have = photos.get(url);
  if (have) return Promise.resolve(have);
  let pending = photosLoading.get(url);
  if (!pending) {
    pending = photoLoader.loadAsync(url).then((t) => {
      // every seat's context holds its own copy: no larger than the seat can show
      (t as THREE.Texture<HTMLImageElement | HTMLCanvasElement>).image = scaledImage(t.image as HTMLImageElement, SEAT_PHOTO_MAX);
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

/**
 * How far back the eye sits, and how much the gallery canvas has to grow.
 * The body is framed as before — by its height and a typical radius — so a
 * round form is not shrunk by one spike. A point that still falls outside
 * that frame (a star's arm, a gear's tooth) steps the eye back and widens
 * the canvas by the same amount, so the body stays the size it was and the
 * whole shape stays inside the canvas.
 */
function frameVessel(positions: ArrayLike<number>) {
  let halfHeight = 0.5;
  let radial = 0;
  let n = 0;
  let bound = 0.5;
  for (let k = 0; k < positions.length; k += 3) {
    const x = positions[k];
    const y = positions[k + 1] - LOOK_Y;
    const z = positions[k + 2];
    halfHeight = Math.max(halfHeight, Math.abs(y));
    radial += Math.hypot(x, z);
    n++;
    bound = Math.max(bound, Math.hypot(x, y, z));
  }
  const body = Math.max(halfHeight, (radial / Math.max(n, 1)) * 1.45);
  const reach = Math.max(body, bound);
  return {
    distance: (reach * 1.12) / Math.sin((FOV / 2) * (Math.PI / 180)),
    canvasScale: reach / body,
  };
}

const canvasScales = new Map<string, number>();

/** How much this form's gallery canvas grows so its furthest point stays in frame. */
export function vesselCanvasScale(form: ArtifactForm, morph: number): number {
  const key = `${formKey(form)}|${morph}`;
  const hit = canvasScales.get(key);
  if (hit !== undefined) return hit;
  const glass = buildGlass(form, morph);
  const scale = frameVessel(glass.positions).canvasScale;
  glass.geometry.dispose();
  canvasScales.set(key, scale);
  return scale;
}

function VesselObject({
  parts, photoUrl, seed, tune, room, glassMode = "refract", sheetMode = "draped", face = "inside", focused, still, facing, viewPitch, viewToken, locked = false, onView, onPick, onReady, blurPx = 0,
}: VesselArtifactProps & { parts: VesselParts }) {
  const { camera, gl, scene, size, invalidate } = useThree();
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
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const onViewRef = useRef(onView);
  onViewRef.current = onView;

  // at the apex the vessel is in hand: a drag turns the eye round it and up or down, as in the lab
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  // a mouse resting on the vessel at the apex: it floats and turns, unless a drag has it in hand
  const hover = useRef({ over: false, held: false, amount: 0, phase: 0 });
  const body = useRef<THREE.Mesh>(null);
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
        pitch.current = Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitch.current - (e.clientY - last.y) * 0.25));
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
  blurLive.current = blurPx;
  const soften = useRef<Soften | null>(null);
  useEffect(() => () => {
    const s = soften.current;
    if (!s) return;
    s.frame.dispose();
    s.pong.dispose();
    s.blur.dispose();
    s.quad.geometry.dispose();
  }, []);
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
  }, [pass, gl, size, invalidate]);

  const built = useMemo<Built>(() => ({ ...parts, distance: frameVessel(parts.glass.positions).distance }), [parts]);
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
  writeGlassUniforms(glassU, { tune, seed, key, patches, room, groundY, reflect: -1, air });

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
      sheetU.uPhoto.value = p.texture;
      sheetU.uImageAspect.value = p.aspect;
      invalidate();
    }).catch(() => { if (live) { photoReady.current = true; invalidate(); } });
    return () => { live = false; };
  }, [photoUrl, photo, sheetU, invalidate]);

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
  const reportReady = () => { if (!didRender.current && photoReady.current) { didRender.current = true; readyRef.current?.(gl.domElement); } };
  const refract = glassMode === "refract";
  useFrame(({ gl: renderer, scene, camera: view, clock }, dt) => {
    if (compiledFor.current !== glassMode) return;
    const step = Math.min(dt, 0.1);
    if (focused && !still) yaw.current += tune.turn * step;
    const h = hover.current;
    const want = focused && h.over && !h.held && !reducedMotion ? 1 : 0;
    h.amount += (want - h.amount) * (1 - Math.exp(-step / HOVER_EASE_S));
    if (h.amount > 1e-3) {
      h.phase += step * (2 * Math.PI / HOVER_BOB_S);
      if (!lockedRef.current) yaw.current -= HOVER_SPIN * h.amount * step;
      invalidate();
    }
    // the glow's clock: it moves only while the seat's frameloop runs (focused or moving); a still seat holds its frame
    glassU.uTime.value = clock.elapsedTime;
    const y = yaw.current, p = (pitch.current * Math.PI) / 180, d = built.distance;
    const bob = HOVER_BOB * d * h.amount * Math.sin(h.phase);
    camera.position.set(-Math.sin(y) * Math.cos(p) * d, LOOK_Y - bob + Math.sin(p) * d, Math.cos(y) * Math.cos(p) * d);
    camera.lookAt(0, LOOK_Y - bob, 0);
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
      reportReady();
      return;
    }
    glassU.uResolution.value.set(pass.target.width, pass.target.height);
    view.layers.set(0);
    renderer.setRenderTarget(pass.target);
    renderer.render(scene, view);
    renderer.setRenderTarget(out);
    renderer.render(pass.scene, pass.ortho);
    renderer.clearDepth();
    view.layers.set(FRONT_LAYER);
    renderer.autoClear = false;
    renderer.render(scene, view);
    renderer.autoClear = true;
    view.layers.enableAll();
    if (s) spreadSoft(renderer, s, sigma);
    reportReady();
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
  </>;
}

export function VesselArtifact(props: VesselArtifactProps) {
  // the canvas waits for its glass and cloth: the queue builds them a memory at a
  // time, nearest first, so neither the settle nor the context and its shaders
  // arrive for every seat on the same frame
  const parts = useVesselParts({
    form: props.form, morph: props.morph, tune: props.tune, sheetMode: props.sheetMode ?? "draped",
    seed: props.seed, sheetSize: props.sheetSize,
  }, props.priority ?? (props.focused ? 0 : 1));
  if (!parts) return <div style={{ width: "100%", height: "100%" }} />;
  return (
    // offsetSize: the seat is scaled by a CSS transform along the curve, and a resize observer does not see
    // transforms — measured by its bounds, a canvas first mounted far down the curve would be rendered at
    // that tiny size and stretched when it reached the apex
    <Canvas camera={{ position: [0, 0.6, 9], fov: FOV, near: 0.1, far: 50 }}
      dpr={[1, MAX_DPR]} gl={{ antialias: true, alpha: true, premultipliedAlpha: true }} frameloop={props.frameloop}
      resize={{ offsetSize: true }}
      style={{ width: "100%", height: "100%" }}>
      <VesselObject {...props} parts={parts} />
    </Canvas>
  );
}
