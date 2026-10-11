import { useCompact } from "../hooks/useCompact";
import { createAscentBloom, createSilhouetteBlur } from "../lib/ascentBloom";
import { ascentLightAt, ASCENT_LIGHT_GLSL, ASCENT_INTERIOR_GLSL } from "../lib/ascentLight";
import { FlowPageGrid } from "../components/FlowPageGrid";
import { vesselTint } from "../lib/vesselTint";
import { holdSurfaceFrame } from "../lib/surfaceHandoff";
import { pondCameraPose, POND_CAMERA_HEIGHT, POND_CAMERA_Z, POND_LOOK as SURFACE_LOOK, SINK_WASH } from "../lib/pondCamera";
import { DistanceConstellation } from "./DistanceConstellation";
import { FIELD_FOCAL, memoryDepth, type FieldTextBounds } from "./vesselField";
import { SAMPLE_TRANSCRIPT, sampleAssignment } from "../data/sampleMemory";
import { getTranscription } from "../lib/transcribe";
import { RHYTHM_MAX, withRhythm, rhythmValue, rhythmMorph, createRhythmPinch } from "../lib/memoryRhythm";
import { createDistancePush } from "../lib/memoryDistanceGesture";
import { advanceArtifactPose } from "../lib/artifactPose";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CHROME_GRAY } from "../lib/colors";
import { CAROUSEL_PATH, DESCENT_PATH as DESCENT_ROUTE, DESCENT_STEP_PATHS, descentStepForPath, isDescentPath, type DescentStep, MEMORY_POND_PATH, NAMING_PATH, RECORD_START_PATH, TRANSCRIPT_PATH } from "../lib/routes";
import { PuddleTranscriptPage } from "../components/PuddleTranscriptPage";
import { MemoryPondPage } from "../components/MemoryPondPage";
import { PondRecordingOverlay } from "../components/PondRecordingOverlay";
import { BackButton } from "../components/BackButton";
import { saveMemory } from "../lib/memoryStore";
import {
  createGestureGate,
  handCenter,
  landmarkDistance,
  preloadHandTracking,
  useHandTracking,
} from "../hooks/useHandTracking";
import { GestureHint } from "../components/GestureHint";
import { ShutterCamera } from "../components/ShutterCamera";
import { HandTrackingDialog } from "../components/HandTrackingDialog";
import { MATERIAL_PRESETS } from "../components/SceneViewer";
import { draftColorIndex } from "../components/NamingRim";
import { INSTRUCTION_SIZE, META, NOTE_SIZE, SANS, SERIF, SERIF_CJK, TITLE, UNDERWATER_PHONE } from "../lib/theme";
import { flowProgress, smoothProgress } from "../lib/landingTransition";
import { POND_DROP_SLOTS, type VoiceRippleSpot } from "../lib/voicePeaks";
import { POND_TRAIL_SLOTS } from "../lib/pondTrail";
import { PondWater, type PondProps, POND_WAVES_GLSL, POND_SURFACE_GLSL } from "../components/PerspectivePond";
import { PAGE_HEADER_MARK, PageHeader } from "../components/PageHeader";
import { TextButton } from "../components/TextButton";
import { PillButton } from "../components/PillButton";
import { SpectrumSlider } from "../components/SpectrumSlider";
import { OklchColorField } from "../components/OklchColorField";
import { sampleHomePalette, uvFromHomePalette } from "../lib/homePaletteField";
import { CAPTION_TITLE_GAP, CAPTION_TITLE_STYLE, CAPTION_YEAR_STYLE } from "../components/PuddleDiveGallery";
import { MODEL_SPACE } from "../components/SceneViewer";
import { buildPhotoUv } from "../components/MemoryPhotoLayer";
import { createArtifactGeometry } from "../hooks/useArtifactGeometry";
import { computeMeshNormals, formFromState, formKey, getArtifactMesh, type ArtifactForm } from "../lib/superformula";
import { assignMemoryShape, isMemoryAssignment, type MemoryAssignment } from "../lib/memoryShape";
import { requestMemoryAssessment } from "../lib/assessMemory";
import { DEFAULT_OKLCH, meshCoreFromOklch, oklchToHex, type Oklch } from "../lib/oklch";
import { FILM_LOOK_GLSL, filmLookUniforms, prepareFilmPhoto } from "../lib/filmLook";
import { SHEET_GLSL, STRIP_FACE_GLSL, STRIP_GLSL, STRIP_MM, createEdgePrint, sheetUniforms } from "./filmStrip";
import {
  CLOUD_KNOBS, CLOUD_TRACKS, CLOUD_TUNE_DEFAULT, buildCloudGeometry, cloudPhaseBlocks, createCloudMaterial, createCloudUniforms,
  setCloudUniforms, type CloudTune, type PhaseBlock, type TuneKnob,
} from "./wrapCloud";
import {
  DISTANCE_FADE, DISTANCE_FAR, FOV, FRONT_LAYER, Mist, VESSEL_TUNE_DEFAULT, backdropVertex, blitFragment, buildDrapedSheet, buildGlass, buildWallMap,
  createGlassUniformSet, createSheetUniformSet, fitSheetSize, glassRefractFragment, glassVertex, keyFrom, seedDirections,
  sheetFragment, sheetVertex, writeGlassUniforms, writeSheetUniforms, type Room, type SheetUniformSet, type VesselTune,
} from "./VesselPreview";
import photoA from "../../assets/memory-photo.jpg";
import photoB from "../../assets/memory-photo-02.jpg";
import { PortraitFit, viewHalfTan } from "../lib/portraitView";
import { readPhoto } from "../lib/photoSize";
import { MAX_DPR, RT_SAMPLES } from "../lib/deviceTier";

/*
 * Lab: the whole shot from the photo to the named memory, in one canvas.
 *
 * The photo falls onto the pond as a strip of film and floats; the view sinks
 * through it into the water, where the form surfaces and is shaped (shape,
 * distance, color — pointer-driven here, the same three signals the gesture
 * pages produce). On confirm the view draws back, the film's emulsion lets
 * go, and the photo develops on the form — darks first, as on paper in the
 * tray; the form then rises, breaks the surface, and is named where it
 * floats. (With `?cloud=1` the photo instead leaves the film as a point
 * cloud that falls onto the form — `wrapCloud.ts`, kept out of the shot.)
 *
 * The form is the vessel of /lab/vessel (VesselPreview.tsx): thin refracting
 * glass with the 35mm strip draped along its inner wall, the photo a thing
 * inside the glass, there from the moment the form surfaces (`?print=wrap`
 * has the strip hang blank until the wrap, when the photo develops into it).
 * The distance step is the vessel's own haze; the colour step reaches the
 * glass only through the room it reflects.
 *
 * The water is the pond's own wave field (POND_WAVES_GLSL) with an underside
 * added. While the form is being handled the water loses color and
 * saturation, so the thing in hand is what has the color.
 */

type Phase =
  | "choose" | "falling" | "floating" | "descending"
  | "shape" | "rhythm" | "distance" | "color"
  | "wrapping" | "rising" | "naming" | "saved";
type Step = DescentStep;
/** The distance step's farthest place: half of the old full fade. */
const DISTANCE_MAX = DISTANCE_FAR;
/** At far & faded the neighbours have moved this far along the gallery's depth range (memoryDepth's share): most have passed the eye. */
const PREVIEW_TRAVEL = 0.75;
/** At far & faded the handled memory reads at this share of its near size, by standing farther along the same line of sight. */
const DISTANCE_FAR_SCALE = 0.9;
const DISTANCE_RECEDE = 1 / DISTANCE_FAR_SCALE - 1;

const POND_CAMERA = new THREE.Vector3(0, POND_CAMERA_HEIGHT - .15, POND_CAMERA_Z);
const POND_LOOK = SURFACE_LOOK.clone();
/** Where the film comes to rest — lower third of the pond view. */
const FILM_AT = new THREE.Vector3(0, 0, 2);
const FILM_YAW = 0.14;
const FILM_LENGTH = 2.0;
const FILM_WIDTH = FILM_LENGTH * STRIP_MM.width / STRIP_MM.length;
/** While a photo is chosen the empty strip hangs this far in front of the lens. */
const CHOOSE_DEPTH = 3.7;
/** It surfaces grain by grain over the first moments of the page. */
const EMERGE_S: [number, number] = [0.2, 2.0];
/** The chosen photo develops into the window, and the strip is let go a beat later. */
const DEVELOP_S = 1.4;
const LET_GO_S = 2.1;
const FALL_S = 3.8;
/** The pond answers a beat before the strip has quite settled on it. */
const RIPPLE_LEAD_S = 0.45;
const SETTLE_S = 0.9;
const HOLD_S = 1.1;
const DESCENT_S = 6.2;
const FORM_AT = new THREE.Vector3(0, -5, -1.2);
const FORM_REVEAL_S: [number, number] = [3.9, 5.2];
/** The form comes from below; the eye settles first so its last ascent is clear. */
const FORM_ASCENT_S: [number, number] = [4.2, 8.2];
const FORM_ASCENT_HEIGHT = 2.4;
/** The turn the form opens at: the sheet hangs on the vessel's −z wall (anchorAngle 180),
    and the view looks down −z, so a half turn puts the picture toward the eye. */
const OPEN_YAW = Math.PI;
/** The vessel's radius as a fraction of the screen's half-height in the lab (radius ~1,
    `distance` 9, fov 18) — the size its refraction knobs were tuned at. */
const LAB_ON_SCREEN = 1 / (9 * Math.tan((FOV / 2) * Math.PI / 180));
/* The vessel as the gallery seats it (VesselGalleryPreview's tune): draped sheet, face
   to the glass, the perforations reduced, no table; `haze` is written each frame from the
   distance step, `frostStrength` is pinned so the descent's own ?frost= does not reach it. */
const VESSEL_TUNE: VesselTune = {
  ...VESSEL_TUNE_DEFAULT,
  morph: 0, frostStrength: 0.15,
  holeSize: 0.6, holeWidth: 0.75, holeFade: 0.75, holeRim: 0.25,
  mono: 0, negative: 0,
  pitch: 4, turn: 0, ground: 0, haze: 0,
  ...DISTANCE_FADE,
};
/** The room the glass reflects, before the water's colours are written over it each frame. */
const VESSEL_ROOM: Room = { above: "#e6e7ea", below: "#ffffff" };
/** How far the water gives way to paper while the form is being handled. */
const WATER_WASH = 1.0;
/** Complete the pale background before the form finishes its underwater ascent. */
const WASH_IN_S: [number, number] = [1.8, 5.5];
/** A little depth before the form appears, clearing with its pale reveal. */
const DESCENT_SHADE = 0.08;

/* The wrap: the view draws back and tilts up so the film overhead and the
   form below are both in frame, and the form lifts a little toward the light;
   the film's emulsion lets go and the print develops on the form. Everything
   about the wrap that is a matter of judgement is a knob here, live on the
   lab's panel; these are the values it opens with. Write back what the
   sliders settle on. The point cloud (the photo leaving the film as points
   that fall onto the form) is kept whole in `wrapCloud.ts` and is **not part
   of the shot** unless `?cloud=1` is on the URL; its knobs extend these. */
interface WrapTune extends CloudTune {
  // framing: the camera and its look at the end of the draw-back; the form's seat (formZ under the film, which rests at z 2).
  // The form sits formY − lookY below the look point: how far it settles down the frame as the view draws back
  cameraY: number; cameraZ: number; lookY: number; lookZ: number; formY: number; formZ: number;
  // the view turned about the look point, in degrees — to watch the fall from another side; the shot itself does not change
  orbitYaw: number; orbitPitch: number;
  // the rise: the form's centre reaches the surface at riseSurfaceAt of the rise (it slows as it nears it), comes up
  // riseBob above its seat and settles back. The eye keeps the wrap's offset to the form and goes up with it, looking
  // at it, until riseViewUntil; between there and riseViewBack it eases to the pond view, where the memory is named.
  // riseAbove lifts the eye's offset a little as it follows, so the form is seen from slightly above by the surface
  riseSurfaceAt: number; riseBob: number; riseViewUntil: number; riseViewBack: number; riseAbove: number;
  /** How much the form grows for the wrap, as a fraction of its size: .3 is 1.3× across, ~2.2× the volume. */
  grow: number;
  /** Seen from under the water the film is backlit; this is how much of its image still shows (was .42). */
  filmBelow: number;
  // timing (?cloud=1 only): the cloud releases over releaseS, fixed when it is built — on "again" — and has fallen by fallS,
  // which is then when the rise begins; without the cloud the rise follows the draw-back directly
  releaseS: number; fallS: number;
  // the print develops into the strip inside the glass over overlayIn…overlayOut (seconds after the
  // emulsion begins to let go) — darks first, as the film's own develop brings an image up
  overlayIn: number; overlayOut: number;
}
const WRAP_TUNE_DEFAULT: WrapTune = {
  ...CLOUD_TUNE_DEFAULT,
  cameraY: -3.0, cameraZ: 8.6, lookY: -2.35, lookZ: 2.0, formY: -2.8, formZ: 2.0,
  orbitYaw: 0, orbitPitch: 0,
  riseSurfaceAt: 0.55, riseBob: 0.14, riseViewUntil: 0.55, riseViewBack: 1.0, riseAbove: 0.6,
  grow: 0.3,
  filmBelow: 0.6,
  releaseS: 2.2, fallS: 8.0,
  overlayIn: 3.2, overlayOut: 7.0,
};
/* The transport: pause, speed, and a seek along the wrap and the rise. The
   page writes `paused`, `speed` and `seek`; the stage reads them each frame
   and writes back `shot` (seconds since confirm), `length`, and whether the
   shot has reached the wrap at all. Only the wrap and the rise can be
   scrubbed — before them the shot latches state (the fall, the hold, the
   descent) that is not worth unwinding. */
interface Transport {
  paused: boolean;
  speed: number;
  /** Seconds since confirm to jump to; the stage clears it once taken. */
  seek: number | null;
  shot: number;
  length: number;
  active: boolean;
}
const WRAP_CAMERA = new THREE.Vector3(0, WRAP_TUNE_DEFAULT.cameraY, WRAP_TUNE_DEFAULT.cameraZ);
const WRAP_LOOK = new THREE.Vector3(0, WRAP_TUNE_DEFAULT.lookY, WRAP_TUNE_DEFAULT.lookZ);
const WRAP_FORM_AT = new THREE.Vector3(0, WRAP_TUNE_DEFAULT.formY, WRAP_TUNE_DEFAULT.formZ);
const WRAP_MOVE_S = 2.2;
/** When the wrap ends and the rise begins: as the draw-back ends, with nothing held between
    (only the point cloud, when on, needs its fall to finish first). */
const wrapEndsFor = (k: { fallS: number }) => (CLOUD ? WRAP_MOVE_S * 0.5 + k.fallS : WRAP_MOVE_S);
/* The rise: up through the surface, to the seat where the memory is named. */
const RISE_S = 9.0;
/** How fast the form is still going when its centre meets the surface, relative to its underwater pace
    (the cubic below arrives at the surface at this slope; ~.6 of its mid-water speed). */
const RISE_TOUCH = 0.9;
/** The rise's way along its path by k (0…1 of RISE_S), given where the surface lies on the path
    (`surface`, a fraction of it), when the centre should reach it (`at`), and how far the form comes up past
    its seat (`bob`, as a fraction of the way above the surface). Under the water a cubic lifts it out of
    rest, carries it and slows it toward the surface; above, it keeps slowing (a power curve that takes up
    the surface's speed, so there is no step), overshoots by `bob` late in the way and settles back onto its
    seat, as a buoyant thing does — exactly 1 at the end. */
function riseProgress(k: number, surface: number, at: number, bob: number): number {
  const S = Math.min(0.95, Math.max(0.05, surface));
  const kS = Math.min(0.9, Math.max(0.1, at));
  if (k < kS) {
    const x = k / kS;
    return S * (x * x * (3 - 2 * x) + RISE_TOUCH * (x * x * x - x * x));
  }
  const x = Math.min(1, (k - kS) / (1 - kS));
  // the slope the surface hands over, in the way above it
  const p = Math.max(1.2, (S * RISE_TOUCH * (1 - kS)) / (kS * (1 - S)));
  const sinx = Math.sin(Math.PI * x);
  const bump = (sinx * sinx * x * x) / 0.334; // 0 at both ends with their slopes, 1 at its peak near .62
  return S + (1 - S) * (1 - Math.pow(1 - x, p) + bob * bump);
}
/** The film thins away as the eye passes under it on the way down (camera depth, world units) and does not return. */
const FILM_GONE_DEPTH: [number, number] = [0.05, 0.9];
const NAME_FORM_AT = new THREE.Vector3(0, 0.95, 2.0);
/* The form comes straight up under the film to its seat; the first point is the
   wrap's seat, written live from the panel. The eye has no path of its own: it
   follows the form (see the frame loop) and crosses to the pond view at the end. */
const RISE_FORM = new THREE.CatmullRomCurve3([
  WRAP_FORM_AT.clone(),
  new THREE.Vector3(0, -1.7, 2.0),
  new THREE.Vector3(0, -0.3, 2.0),
  NAME_FORM_AT.clone(),
], false, "centripetal");

/* The descent, as one continuous path: settle toward the print, look down
   onto it, pass through, then level out in the water facing the form. */
const DESCENT_PATH = new THREE.CatmullRomCurve3([
  POND_CAMERA.clone(),
  new THREE.Vector3(0, 2.0, 6.2),
  new THREE.Vector3(0, 0.9, 3.2),
  new THREE.Vector3(0, 0.22, 2.1),
  new THREE.Vector3(0, -0.7, 2.0),
  new THREE.Vector3(0, -2.4, 2.4),
  new THREE.Vector3(0, -3.9, 3.0),
  new THREE.Vector3(0, -4.6, 3.4),
], false, "centripetal");
const DESCENT_LOOK = new THREE.CatmullRomCurve3([
  POND_LOOK.clone(),
  new THREE.Vector3(0, -0.2, -6),
  new THREE.Vector3(0, -0.1, 1.4),
  new THREE.Vector3(0, -1.0, 1.95),
  new THREE.Vector3(0, -3.0, 1.7),
  new THREE.Vector3(0, -4.5, 0.4),
  new THREE.Vector3(0, -5.0, -0.6),
  FORM_AT.clone(),
], false, "centripetal");

const PHOTOS = [photoA, photoB];

/* Lab switches on the URL. ?speed=0.25 plays the whole shot at quarter speed.
   ?from=wrap opens on the wrap itself — the photo already on the film, the
   descent done, the form surfaced and handled, confirm just pressed — so the
   grains can be judged without the minute before them; "again" replays from
   the same place. With it, ?photo=0|1 picks the still and ?morph= / ?frost=
   (0–1) set how the form was shaped and misted. */
const PARAMS = new URLSearchParams(window.location.search);
const SPEED = Number(PARAMS.get("speed")) || 1;
/** Pointer/keyboard-only lab runs need not request the camera. */
const CAMERA_ENABLED = PARAMS.get("camera") !== "off";
const FROM: "wrap" | null = PARAMS.get("from") === "wrap" ? "wrap" : null;
/** `?cloud=1`: the photo leaves the film as a point cloud (`wrapCloud.ts`). Off by default — not part of the shot. */
const CLOUD = PARAMS.get("cloud") === "1";
/** The photo is in the strip inside the glass from the moment the form surfaces, as the
    gallery seats it; `?print=wrap` has it develop into the strip at the wrap instead. */
const PRINT_EARLY = PARAMS.get("print") !== "wrap";
const toggleCloud = () => {
  const url = new URL(window.location.href);
  if (CLOUD) url.searchParams.delete("cloud"); else url.searchParams.set("cloud", "1");
  window.location.assign(url.toString());
};
const unitParam = (key: string) => {
  const v = Number(PARAMS.get(key));
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
};
const PREVIEW_PHOTO = PHOTOS[Math.min(PHOTOS.length - 1, Math.max(0, Math.floor(Number(PARAMS.get("photo") ?? 1)) || 0))];
const PREVIEW_MORPH = unitParam("morph");
const PREVIEW_FROST = unitParam("frost");

/** The water's body, seen from inside it. It is the pond's own sky and the
    water a shade under that sky — the same pair the surface uses — only
    darker with depth. The hue stays, and the chroma does not grow. uWash
    gives it up almost entirely while the form is handled: the landing page's
    paper tones, a trace of the water left in them, soft clouds at very low
    chroma — and uTint lets the chosen color settle into those clouds. */
const VOLUME_GLSL = /* glsl */ `
  uniform float uWash;
  uniform float uDescentShade;
  uniform vec3 uTint;
  uniform float uTintAmount;
  uniform float uClock;
  uniform float uShapePush;
  uniform vec3 uShapeRay;
  float washHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float washNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(washHash(i), washHash(i + vec2(1, 0)), f.x),
               mix(washHash(i + vec2(0, 1)), washHash(i + vec2(1, 1)), f.x), f.y);
  }
  vec3 volumeColor(vec3 dir) {
    // A broad, uneven lens presses the colour field as the form changes.
    // No travelling fronts or light rings: only the existing colour moves.
    vec3 d = dir - uShapeRay;
    float lens = exp(-dot(d * vec3(.85, 1.15, 1.0), d * vec3(.85, 1.15, 1.0)) / .7);
    vec3 drift = vec3(
      washNoise(dir.xz * 2.0 + uClock * .055) - .5,
      washNoise(dir.yz * 2.6 - uClock * .045 + 4.7) - .5,
      0.0);
    dir = normalize(dir + (d * .16 + drift * .10) * lens * uShapePush);
    vec3 sky = vec3(.888, .902, .897);
    vec3 pond = sky * vec3(.90, .93, .93);
    vec3 high = mix(pond, sky, .35);
    vec3 mid = pond * .97;
    // The floor of the water, only a step under the pond — not a dark well.
    vec3 deep = pond * .92;
    vec3 c = mix(deep, mid, smoothstep(-.9, .1, dir.y));
    c = mix(c, high, smoothstep(.1, .9, dir.y));
    // the paper: #c8c9ce low, #ededee high, as the landing gradient
    vec3 paper = mix(vec3(.784, .788, .808), vec3(.93, .93, .934), smoothstep(-.8, .7, dir.y));
    float cloud = washNoise(dir.xy * 2.4 + vec2(uClock * .012, dir.z * .5)) * .65
                + washNoise(dir.xy * 6.0 - vec2(0.0, uClock * .02)) * .35;
    vec3 washed = mix(paper, c, .08) + (cloud - .5) * .035;
    // only a breath of it: the colour step's water stays the paper of the distance step
    washed = mix(washed, uTint, uTintAmount * (.04 + .07 * cloud));
    return mix(c, washed, uWash) * (1.0 - uDescentShade);
  }
`;

/* The surface seen from under it, and the folds of light on it. Shared by the
   pond plane and the full-frame underwater atmosphere. */
const CEILING_GLSL = /* glsl */ `
  uniform float uCeiling;
  uniform float uAtmosphericLight;
  float uwBreath(float t, float phase, float rate) {
    return 0.55 + 0.45 * sin(t * rate + phase) * (0.75 + 0.25 * sin(t * rate * 0.37 + phase * 1.7));
  }
  float uwFolds(vec2 p, float t) {
    p += vec2(sin(t * .12) * .16, cos(t * .09) * .13);
    vec2 q = p + 0.38 * vec2(sin(p.y * 1.25), cos(p.x * 1.05));
    float a = sin(q.x * 2.0 + sin(q.y * 0.9) * 0.8);
    float b = sin(q.y * 1.8 + sin(q.x * 0.75) * 0.9);
    float c = sin((q.x + q.y) * 1.35 + sin((q.x - q.y) * 1.1) * 0.7);
    float la = 1.0 - abs(a), lb = 1.0 - abs(b), lc = 1.0 - abs(c);
    float phase = sin(p.x * 0.6 + p.y * 0.45) * 2.2 + cos(p.x * 0.33 - p.y * 0.7) * 1.6;
    float ba = uwBreath(t, phase, 0.55);
    float bb = uwBreath(t, phase + 2.1, 0.43);
    float bc = uwBreath(t, phase + 4.2, 0.67);
    float lines = pow(la, 3.0) * 0.4 * ba + pow(lb, 3.0) * 0.4 * bb + pow(lc, 2.5) * 0.3 * bc;
    float cells = pow(la * lb, 1.6) * 0.5 * (ba + bb) * 0.5 + pow(lb * lc, 1.6) * 0.35 * (bb + bc) * 0.5;
    return (lines + cells) * 1.25;
  }
  vec3 ceilingSurface(vec2 p, vec3 eye, vec2 flow, vec3 normal) {
    // Mirror only the viewpoint. The overhead water keeps the top surface's
    // actual ripple normals, drifting ribbons and fine grain, at the same
    // world coordinates and clock; no independent tiled caustic texture.
    vec3 mirroredEye = normalize(eye - vec3(p.x, 0.0, p.y));
    return pondSurfaceColor(p, flow, normal, mirroredEye);
  }
  // Shafts: the surface light followed down into the water along the eye's ray,
  // as far as reach, strongest just under the surface and thinning with depth.
  vec3 ceilingRays(vec3 dir, float reach) {
    vec3 lightDir = normalize(vec3(0.42, -1.0, 0.55));
    float jitter = hash(gl_FragCoord.xy);
    vec3 rays = vec3(0.0);
    const int STEPS = 16;
    for (int i = 0; i < STEPS; i++) {
      float f = (float(i) + jitter) / float(STEPS);
      float dist = 0.4 + f * reach;
      vec3 p = cameraPosition + dir * dist;
      vec2 entry = (p - lightDir * (p.y / lightDir.y)).xz;
      float depth = max(0.0, -p.y);
      float folds = pow(uwFolds(entry * 0.55, uTime), 1.5);
      rays += folds * exp(-depth * 0.24) * exp(-dist * 0.06);
    }
    rays /= float(STEPS);
    float band = smoothstep(-0.7, 0.05, dir.y);
    return rays * vec3(.95, .97, .96) * 1.12 * band;
  }
  // A shared background for the plane and the full-frame water. As the eye
  // rises, a broad gradient picks up the surface's pale reflected sky. The
  // same colour must sit behind the plane wherever it fades or clips away.
  vec3 underwaterBodyColor(vec3 dir) {
    vec3 color = volumeColor(dir);
    vec3 sky = vec3(.888, .902, .897);
    vec3 surfaceTone = mix(sky * vec3(.76, .80, .80), sky, .9);
    float nearSurface = 1.0 - smoothstep(.25, 3.5, max(0.0, -cameraPosition.y));
    float skyGradient = smoothstep(-.38, .28, dir.y);
    color = mix(color, surfaceTone, nearSurface * skyGradient * uCeiling * .78);
    vec2 s = dir.xz / max(.25, dir.y + .45);
    float shaft = pow(noise(vec2(s.x * 3.0 + uTime * .05, s.y * .6)), 3.0);
    color += shaft * smoothstep(-.2, .5, dir.y) * .08 * (1.0 - uWash * .7) * (1.0 - uCeiling);
    // The former dir.y < .2 cutoff drew a visible horizontal colour band.
    // Ease the shafts into the surface instead, identically in both passes.
    if (uAtmosphericLight > .001) {
      float shaftFade = 1.0 - smoothstep(-.06, .32, dir.y);
      // Lift the water's own hue without adding white and clipping channels.
      float strength = ceilingRays(dir, 9.0).g * uAtmosphericLight * shaftFade;
      float peak = max(max(color.r, color.g), max(color.b, .001));
      vec3 litWater = color / peak * min(.94, peak + .16);
      color = mix(color, litWater, 1.0 - exp(-strength * 3.0));
    }
    return color;
  }
`;

const waterVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/* Above: the pond's surface shading, the same as PerspectivePond. Below:
   Snell's window — the sky only reaches the eye inside ~48° of straight up;
   beyond it the surface mirrors the depths, in the pond's own hue. The two
   meet across the crossing, so the water does not change colour as the eye
   goes through. */
const waterFragment = /* glsl */ `
  ${POND_WAVES_GLSL}
  ${POND_SURFACE_GLSL}
  ${VOLUME_GLSL}
  ${CEILING_GLSL}
  varying vec3 vWorld;
  void main() {
    vec2 p = vWorld.xz;
    vec2 flow;
    vec3 n = pondSurfaceNormal(p, flow);
    vec3 eye = normalize(cameraPosition - vWorld);
    vec3 sky = vec3(.888, .902, .897);
    vec3 above = pondSurfaceColor(p, flow, n, eye);
    float haze = 1.0 - exp(-max(0.0, -p.y - 8.0) * .028);
    above = mix(above, sky, haze);
    above += (hash(gl_FragCoord.xy) - .5) * .017;
    float aboveAlpha = 1.0 - smoothstep(140.0, 400.0, -p.y);
    // Above the crossing the frame is the pond, and nothing else.
    if (cameraPosition.y > .12) {
      gl_FragColor = vec4(above, aboveAlpha);
      return;
    }
    vec3 up = -eye;
    float cosUp = max(0.0, dot(up, n));
    float window = smoothstep(.60, .74, cosUp);
    float belowClouds = noise((p + n.xz * 3.0) * .35 + vec2(uTime * .02, 0.0));
    vec3 through = sky * 1.04 + (belowClouds - .5) * .06;
    vec3 mirrored = volumeColor(vec3(up.x, -up.y, up.z)) * .98;
    vec3 below = mix(mirrored, through, window);
    below += smoothstep(.56, .66, cosUp) * (1.0 - smoothstep(.66, .78, cosUp)) * .05;
    float dist = length(cameraPosition - vWorld);
    float ceilingOn = smoothstep(0.0, 0.3, uCeiling);
    if (uCeiling > 0.001) {
      vec3 mirrorEye = vec3(cameraPosition.x, -cameraPosition.y, cameraPosition.z);
      below = mix(below, ceilingSurface(p, mirrorEye, flow, n), ceilingOn);
    }
    // the surface runs out into the body of the water, so its far edge is never a line; as it
    // comes in it is close-hazed, so it is seen first where it is nearest — over the top of the
    // frame — and reaches out toward the horizon as the eye rises to it
    float hazeRate = mix(.045, mix(.16, .018, uCeiling), ceilingOn);
    // Feather the overhead texture into the shared colour gradient well
    // before the geometric horizon; no separately coloured strip beneath it.
    float horizonBlend = mix(1.0, smoothstep(0.0, .38, up.y), ceilingOn);
    float surfaceVisibility = exp(-dist * hazeRate) * horizonBlend;
    below = mix(underwaterBodyColor(up), below, surfaceVisibility);
    below += (hash(gl_FragCoord.xy) - .5) * .017;
    // Still the pond as the eye meets the surface; the quieter body only once it is under.
    // The ascent ends below the surface. Keep the underwater treatment until
    // the white handoff; mixing the above-water colour here created a slab.
    float submerge = mix(1.0 - smoothstep(-1.15, .12, cameraPosition.y), 1.0, ceilingOn);
    // The near plane must never cut a hard colour boundary through the view.
    // Let the continuous full-frame volume take over before the surface clips.
    float nearCover = smoothstep(.15, .75, dist);
    gl_FragColor = vec4(mix(above, below, submerge),
      mix(aboveAlpha, 1.0, submerge) * nearCover);
  }
`;

/* A full-screen pass behind everything: the water's body, with slow shafts of
   light falling from the surface. Transparent above water, so the page's own
   gradient stays the sky. Once the color step lets go (uCeiling), the body
   gains the overhead surface and the shafts that fall from it — the same
   ceiling Nicole's underwater scene paints, seen from this eye. */
const volumeVertex = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
const volumeFragment = /* glsl */ `
  ${POND_WAVES_GLSL}
  ${POND_SURFACE_GLSL}
  ${VOLUME_GLSL}
  ${CEILING_GLSL}
  uniform mat4 uInvProjection;
  uniform mat4 uCameraWorld;
  uniform float uUnder;
  varying vec2 vNdc;
  void main() {
    vec4 v = uInvProjection * vec4(vNdc, 1.0, 1.0);
    vec3 dir = normalize((uCameraWorld * vec4(v.xyz / v.w, 0.0)).xyz);
    vec3 color = underwaterBodyColor(dir);
    color += (hash(gl_FragCoord.xy) - .5) * .017;
    gl_FragColor = vec4(color, uUnder);
  }
`;

/* The film. A cut strip never lies flat: it cups across its width and warps
   toward its torn ends. The water presses most of that out, never all of it,
   and every vertex then rides the surface on its own, so a passing ripple
   bends the strip instead of tilting it as a slab. While it falls it flexes
   with the air. Normals come from the same shape, sampled a step away. */
const filmVertex = /* glsl */ `
  ${POND_WAVES_GLSL}
  uniform vec2 uSize;
  uniform float uFloat;
  uniform float uSink;
  uniform float uCurl;
  uniform float uFlex;
  uniform float uSeed;
  varying vec2 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormal;
  vec3 sheet(vec2 local) {
    vec2 n = local / (uSize * .5);
    float w = uSize.y;
    float z = uCurl * w * (
        .11 * n.y * n.y
      + .035 * n.x * n.x
      + .025 * sin(n.x * 2.2 + n.y * .8 + uSeed)
      + .02 * smoothstep(.6, 1.0, abs(n.x)) * sin(n.y * 4.0 + uSeed * 2.0))
      + uFlex * w * .12 * (n.x * n.x - .33);
    vec4 world = modelMatrix * vec4(local, z, 1.0);
    if (uFloat > 0.0) {
      vec3 field = rippleField(world.xz);
      float h = swellFrom(field, world.xz) + field.x;
      world.y += (h * 1.3 + .012 - uSink * .06) * uFloat;
      world.xz += field.yz * .08 * uFloat;
    }
    return world.xyz;
  }
  void main() {
    vLocal = position.xy * uSize;
    vec3 p = sheet(vLocal);
    vec2 e = uSize * .01;
    vNormal = normalize(cross(sheet(vLocal + vec2(e.x, 0.0)) - p, sheet(vLocal + vec2(0.0, e.y)) - p));
    vWorld = p;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

/* The strip as the film lab draws it (FilmPreview, filmStrip.ts, filmLook.ts):
   a translucent sheet of pale stock whose thickness is not even, torn ends and
   a worn, light-catching edge, the photo developed through filmLook and laid
   in the window as dye at less than full cover, its frame fading into the
   stock. Geometry is in mm so the perforations keep the real 35mm pitch. On
   top of that, what only the shot needs: the develop (darks first), the
   dissolve into grains, the sheen where the curl catches the sky, and the
   backlit face seen from under the water. */
const filmFragment = /* glsl */ `
  ${STRIP_GLSL}
  ${FILM_LOOK_GLSL}
  ${SHEET_GLSL}
  ${STRIP_FACE_GLSL}
  uniform sampler2D uPhoto;
  uniform sampler2D uEdgePrint;
  uniform vec2 uSize;
  uniform float uImageAspect;
  uniform float uFloat;
  uniform float uSeed;
  uniform float uDissolve;
  uniform float uBelow;
  uniform float uDevelop;
  uniform float uFade;
  varying vec2 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec2 toWorld = uSize / STRIP;
    vec2 mm = vLocal / toWorld;

    // the torn outline, worn and scuffed, the perforations cut (filmStrip.ts)
    float d = stripTornOutline(mm, uSeed);
    float dh = stripHole(mm);
    float alpha = stripCoverage(mm, uSeed, d, dh, 1.0);
    // the dissolve: the emulsion lets go in a drifting grain, image first
    float grain = filmNoise(mm * vec2(.9, 1.6) + uSeed * 5.0) * .7 + filmNoise(mm * 4.0) * .3;
    float gone = 1.0 - smoothstep(uDissolve - .3, uDissolve, grain * .8 + .1);
    alpha *= (1.0 - gone) * uFade;
    if (alpha < .01) discard;

    // the face: stock, the photo developing into the window as dye, the cut edge, the edge print
    vec3 color;
    float a;
    stripFace(mm, uSeed, d, dh, sheetWindow(mm, uSeed), uPhoto, uImageAspect, 0.0, uEdgePrint, uDevelop, color, a);

    // a soft sheen where the curl catches the sky, nothing glossy
    vec3 n = normalize(vNormal);
    vec3 eye = normalize(cameraPosition - vWorld);
    if (dot(n, eye) < 0.0) n = -n;
    float sheen = pow(max(0.0, dot(reflect(-eye, n), normalize(vec3(-.3, .8, -.5)))), 18.0);
    color = color * (.92 + .08 * n.y) + sheen * .16;
    color *= mix(1.0, .965, uFloat);
    if (!gl_FrontFacing) {
      // from under the water the film is backlit, light coming through it; uBelow is how much of the image survives that
      color = mix(vec3(.92, .95, .94), color * 1.05, uBelow);
    }
    gl_FragColor = vec4(color, alpha * clamp(a, 0.0, 1.0));
  }
`;

const motesVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixel;
  varying float vFade;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * .17 + aSeed * 12.0) * .1;
    p.y += sin(uTime * .3 + aSeed * 6.283) * .08;
    vec4 view = viewMatrix * modelMatrix * vec4(p, 1.0);
    float dist = -view.z;
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp(uPixel * 16.0 / dist, 1.0, 6.0) * (.5 + aSeed);
    vFade = smoothstep(.3, 1.2, dist) * (1.0 - smoothstep(6.0, 14.0, dist));
  }
`;
const motesFragment = /* glsl */ `
  uniform float uUnder;
  uniform float uWash;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - .5);
    float a = (1.0 - smoothstep(.15, .5, d)) * vFade * uUnder * .5 * (1.0 - uWash * .75);
    if (a < .004) discard;
    gl_FragColor = vec4(.93, .96, .95, a);
  }
`;

/* The water's colours as the vessel's room: what the glass reflects at a grazing
   angle and fades toward at a distance. Under the water the body's high and
   mid tones; while the form is handled, the paper the water washes to; in the
   air above, the sky. The colour pick reaches them as the water's tint does. */
const ROOM_SKY = new THREE.Color(0.888, 0.902, 0.897);
const POND_DEEP = ROOM_SKY.clone().multiply(new THREE.Color(0.90, 0.93, 0.93));
/** The body's high and mid, the same water the volume darkens — the pond's hue, not a stronger teal. */
const ROOM_WATER_ABOVE = POND_DEEP.clone().lerp(ROOM_SKY, 0.35);
const ROOM_WATER_BELOW = POND_DEEP.clone().multiplyScalar(0.97);
const ROOM_PAPER_ABOVE = new THREE.Color(0.93, 0.93, 0.934);
const ROOM_PAPER_BELOW = new THREE.Color(0.784, 0.788, 0.808);
const ROOM_SURFACE = new THREE.Color(0.86, 0.89, 0.88);

/* The touch. While the form is being handled the frame is drawn once more
   through the water near the hands: a soft lens gathers around each hand and
   bends what is behind it — the form's edge, the motes, the light — the way a
   glass vessel bends when a hand reaches for it under water. A moving hand
   leaves a wake that trails it; the disturbance shimmers; at its thickest the
   light splits by a hair. Nothing is added to the scene, only its light bent. */
const UNDERWATER_TOUCH = { radiusScale: .7, intensity: .55 } as const;
const touchVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
const touchFragment = /* glsl */ `
  uniform sampler2D tScene;
  uniform sampler2D tSoftScene;
  uniform vec2 uHand[2];
  uniform vec2 uWake[2];
  uniform float uPress[2];
  uniform float uAspect;
  uniform float uTime;
  uniform float uAmount;
  uniform float uArrivalBlur;
  uniform vec2 uViewport;
  uniform vec2 uArrivalCenter;
  uniform sampler2D tAscentBloom;
  uniform float uAscentBloom;
  uniform float uAscentExposure;
  uniform float uAscentHandoff;
  uniform float uAscentAtmosphere;
  varying vec2 vUv;
  float touchHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float touchNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(touchHash(i), touchHash(i + vec2(1, 0)), f.x),
               mix(touchHash(i + vec2(0, 1)), touchHash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec2 aspect = vec2(uAspect, 1.0);
    vec2 shift = vec2(0.0);
    float near = 0.0;
    for (int i = 0; i < 2; i++) {
      float press = uPress[i];
      if (press < .002) continue;
      vec2 d = (vUv - uHand[i]) * aspect;
      float r2 = dot(d, d) / ${Math.pow(UNDERWATER_TOUCH.radiusScale, 2).toFixed(4)};
      // the lens: strongest a hand's width out from the centre, where the water is pushed aside
      float lens = exp(-r2 / .034);
      shift -= d * lens * .18 * press;
      // the wake: wider and softer, trailing the hand's motion
      float wake = exp(-r2 / .09);
      shift -= uWake[i] * wake * press;
      // the surface of the disturbance is never still
      vec2 shimmer = vec2(
        touchNoise(d * 5.0 + vec2(uTime * .7, -uTime * .5)),
        touchNoise(d * 5.0 + 3.1 - uTime * .6)) - .5;
      shift += shimmer * lens * .012 * press;
      near = max(near, lens * press);
    }
    shift = shift / aspect * uAmount;
    near *= uAmount;
    // Fade displacement at the frame edge instead of stretching its last texel.
    vec2 edge = smoothstep(vec2(0.0), vec2(.04), vUv) * smoothstep(vec2(0.0), vec2(.04), 1.0 - vUv);
    shift *= edge.x * edge.y;
    vec4 c = texture2D(tScene, vUv + shift);
    // the light splits by a hair where the water is thickest
    float split = near * .1;
    c.r = texture2D(tScene, vUv + shift * (1.0 + split)).r;
    c.b = texture2D(tScene, vUv + shift * (1.0 - split)).b;
    // and the gathered water catches a touch more light
    c.rgb += near * .02;
    // Water softens the approaching memory, and growing light diffuses its
    // silhouette during ascent. The page chrome stays crisp in both cases.
    if (uArrivalBlur > .05 && length((vUv - uArrivalCenter) * aspect) < .65) {
      vec4 soft = texture2D(tSoftScene, vUv + shift);
      float mask = 1.0 - smoothstep(.38, .65, length((vUv - uArrivalCenter) * aspect));
      c = mix(c, soft, mask);
    }
    // A smooth highlight shoulder retains gradients instead of clipping HDR
    // faces to a flat white cutout. Begin adapting before emission is visible.
    vec3 white = vec3(.956863, .964706, .960784);
    // Leave the environmental shafts' mid/high tones intact; compress only
    // the upper highlights, where the luminous vessel exceeds display range.
    vec3 knee = white - .06;
    vec3 excess = max(c.rgb - knee, 0.0);
    vec3 rolled = c.rgb - excess + .06 * (1.0 - exp(-excess / .06));
    c.rgb = mix(c.rgb, rolled, smoothstep(0.0, .08, uAscentAtmosphere));
    // Real HDR light from the glass diffuses into the surrounding water.
    // Keep the source's lit contours visible before the whole eye adapts.
    if (uAscentBloom > .001) {
      vec3 glow = texture2D(tAscentBloom, vUv + shift).rgb;
      vec3 spill = vec3(1.0) - exp(-glow * (.3 + .5 * uAscentBloom));
      c.rgb = mix(c.rgb, vec3(.888, .902, .897), spill);
    }
    // The atmospheric wash begins with the artifact's light, in the water's
    // grey-green palette. Keep it translucent so the contour survives;
    // only the last surface handoff takes the scene to full exposure.
    float wash = .32 * (1.0 - exp(-4.0 * pow(uAscentExposure, 2.0)));
    float exposure = mix(wash, 1.0 - exp(-9.0), uAscentHandoff);
    vec3 atmosphericColor = mix(vec3(.888, .902, .897), white, uAscentHandoff);
    c.rgb = mix(c.rgb, atmosphericColor, exposure);
    c.a = mix(c.a, 1.0, exposure);
    gl_FragColor = c;
  }
`;

/** Light transmitted through the pond catches the glass and photo, then blooms. */
function surfaceShader(fragment: string, interior = false) {
  return `${ASCENT_LIGHT_GLSL}\n${interior ? ASCENT_INTERIOR_GLSL : ""}\nuniform float uSurfaceLight;\n${fragment.replace("void main()", "void surfaceBase()")}
    void main() {
      surfaceBase();
      float light = ascentIllumination(vWorld, normalize(vNormalW)) * uAscentRadiance;
      // Transmitted light tints the face toward the surrounding water. Bounded
      // mixing preserves the glass contour instead of clipping it to white.
      vec3 waterLight = vec3(.888, .902, .897);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, waterLight, 1.0 - exp(-light * .32));
      gl_FragColor.rgb += waterLight * light * .045;
      ${interior ? "gl_FragColor.rgb += vec3(.888, .902, .897) * ascentInterior(vWorld, normalize(vNormalW));" : ""}
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.890196, 0.917647, 0.913725), uSurfaceLight);
      gl_FragColor.a *= 1.0 - uSurfaceLight;
    }`;
}
const surfaceGlassFragment = surfaceShader(glassRefractFragment, true);
const surfaceSheetFragment = surfaceShader(sheetFragment);

/** What the window holds before a photo: a single pale texel. */
const BLANK_PHOTO = (() => {
  const texture = new THREE.DataTexture(new Uint8Array([236, 239, 239, 255]), 1, 1);
  texture.needsUpdate = true;
  return texture;
})();

/** The photo chosen for the strip hanging in front of the view. */
interface FallRequest {
  texture: THREE.Texture;
  /** Restore a history entry without replaying the photo drop. */
  restore?: boolean;
}

/** What the page hands the stage, frame by frame, without re-rendering it. */
interface StageState {
  photoReady: boolean;
  /** Route changes seek the existing scene without resetting its water clock. */
  view: "choose" | "surface" | "underwater" | null;
  surfaceLight: number;
  captureSurface?: () => void;
  voicePulses: VoiceRippleSpot[];
  foregroundBounds: FieldTextBounds | null;
  request: FallRequest | null;
  holding: boolean;
  /** The sculpting step the page is on, if any. */
  step: Step | null;
  /** The three signals the gesture pages produce. */
  morph: number;
  frost: number;
  oklch: Oklch;
  /** Where the hands are over the frame (0–1, y up) — the camera's, or the
      pointer standing in for them. The water is bent around them. */
  hands: { x: number; y: number }[];
  /** Set once by the page to begin the wrap, then the rise. */
  wrap: boolean;
  rise: boolean;
  /** The handling is over: the water takes its colour back around the form while the eye stays where it is. */
  release: boolean;
  /** Set once by the page after the release: eye and form float up to the surface, into the light. */
  ascend: boolean;
}

/** The float to the surface: how long it takes, where under the surface the eye stops (the light has taken the frame by then).
    It begins with the release — the water taking its colour back and the surface coming in over the top of the frame
    are one movement with the rise. */
const ASCEND_S = 6.5;
const ASCEND_TO_Y = -0.8;


interface StageProps {
  pond?: PondProps;
  stage: RefObject<StageState>;
  /** Assigned by the page when the run starts, so the page can save it. */
  form: ArtifactForm;
  /** "wrap" opens on the wrap, the shot before it taken as done. */
  from: "wrap" | "color" | null;
  /** The wrap's knobs, read every frame; the panel writes them. */
  tune: RefObject<WrapTune>;
  transport: RefObject<Transport>;
  crossingRef: RefObject<HTMLDivElement | null>;
  glowRef: RefObject<HTMLDivElement | null>;
  /** The light that takes the frame as the eye nears the surface on the ascent. */
  /** The button laid over the hanging strip; kept on it as it sways. */
  pickRef: RefObject<HTMLButtonElement | null>;
  captionRef: RefObject<HTMLDivElement | null>;
  /** The hold line, kept beside the strip as it floats. */
  hintRef: RefObject<HTMLParagraphElement | null>;
  onFallStart: () => void;
  onSettled: () => void;
  onDescend: () => void;
  onUnder: () => void;
  onWrapped: () => void;
  onRisen: () => void;
  /** The ascent has whitened the frame: the naming step can take over. */
  onAscended: () => void;
  /** A seek has taken the shot back to before the wrap ended, or before the rise ended. */
  onRewound: (to: "wrapping" | "rising") => void;
}

/** Made once and kept for the component's life — through a Fast Refresh too,
    which recomputes every memo. For the uniform sets that carry the shot's own
    state (the chosen photo, how far it has developed, the strip's seed, the
    ripples), so a save while the lab is open does not take them back to the start. */
function useKept<T>(make: () => T): T {
  const kept = useRef<T | null>(null);
  if (kept.current === null) kept.current = make();
  return kept.current;
}

function Stage({ pond, stage, form: artifactForm, from, tune, transport, crossingRef, glowRef, pickRef, captionRef, hintRef, onFallStart, onSettled, onDescend, onUnder, onWrapped, onRisen, onAscended, onRewound }: StageProps) {
  const { camera, size, gl, scene } = useThree();
  const time = useRef(0);
  const jumped = useRef(false);
  const dropIndex = useRef(0);
  const voiceRay = useMemo(() => new THREE.Raycaster(), []);
  const voiceNdc = useMemo(() => new THREE.Vector2(), []);
  const voicePlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const voicePoint = useMemo(() => new THREE.Vector3(), []);
  const fall = useRef<{
    at: number; pos: THREE.Vector3; quat: THREE.Quaternion; right: THREE.Vector3;
    width: number; height: number; flex: number; rippled: boolean;
  } | null>(null);
  const developAt = useRef<number | null>(null);
  const landedAt = useRef<number | null>(null);
  const settled = useRef(false);
  /** How far the film has thinned away under the descending eye, 0…1; only ever rises. */
  const filmGone = useRef(0);
  const hold = useRef(0);
  const wasHolding = useRef(false);
  const descentAt = useRef<number | null>(null);
  const reachedBottom = useRef(false);
  const wrapAt = useRef<number | null>(null);
  const wrapped = useRef(false);
  const riseAt = useRef<number | null>(null);
  const risen = useRef(false);
  const ascendAt = useRef<number | null>(null);
  const ascended = useRef(false);
  const broke = useRef(false);
  const film = useRef<THREE.Mesh>(null);
  const photoAt = useRef<number | null>(null);
  /** The vessel: glass, sheet and mist under one transform. */
  const form = useRef<THREE.Group>(null);
  const glassMesh = useRef<THREE.Mesh>(null);
  const mist = useRef<THREE.Group>(null);
  const particles = useRef<THREE.Points>(null);
  const smooth = useRef({ morph: 0, frost: 0, wash: 0, dye: 0, spin: 0, ceiling: 0, atmospheric: 0, stain: 0, recede: 0 });
  const distanceAnchor = useRef(new THREE.Vector3());
  const distanceDepth = useRef(FIELD_FOCAL);
  /** Screen-down shift of the handled vessel. Null until the first frame, so a
   * direct step opens already lowered and a finished ascent eases down. */
  const handlingDrop = useRef<number | null>(null);
  const written = useRef(-1);
  const touches = useRef([
    { at: new THREE.Vector2(-10, -10), wake: new THREE.Vector2(), press: 0 },
    { at: new THREE.Vector2(-10, -10), wake: new THREE.Vector2(), press: 0 },
  ]);
  const tint = useMemo(() => new THREE.Color(), []);
  const scratch = useMemo(() => ({
    v: new THREE.Vector3(), forward: new THREE.Vector3(), q: new THREE.Quaternion(),
    flutter: new THREE.Quaternion(), euler: new THREE.Euler(),
    flat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, FILM_YAW, 0, "YXZ")),
    cameraAt: new THREE.Vector3(), lookAt: new THREE.Vector3(), formAt: new THREE.Vector3(),
    wrapCamera: WRAP_CAMERA.clone(), wrapLook: WRAP_LOOK.clone(), wrapForm: WRAP_FORM_AT.clone(),
    roomAbove: new THREE.Color(), roomBelow: new THREE.Color(), roomAir: new THREE.Color(),
  }), []);

  /* The form: a superformula artifact of its own, grown from its sphere pose.
     Growth is written on the CPU, as BubbleViewer does; the glass is this
     geometry, and the sheet inside follows it (below). */
  // m2 changes only the target pose. Keep the displayed glass and its settled
  // photo sheet alive, with identical topology for every value from 0 to 16.
  const bodyKey = formKey({ ...artifactForm, side: { ...artifactForm.side, m: 0 } });
  const targetPose = useMemo(() => getArtifactMesh(artifactForm, 128), [artifactForm]);
  const artifact = useMemo(() => createArtifactGeometry(artifactForm, 128), [bodyKey]);
  const settledPose = useRef(targetPose);
  const previousM2 = useRef(artifactForm.side.m);
  const normals = useMemo(() => new Float32Array(artifact.rest.normals.length), [artifact]);
  useEffect(() => { written.current = -1; }, [artifact]);
  useEffect(() => () => artifact.geometry.dispose(), [artifact]);

  /* The vessel's sheet: the strip draped along the inner wall, settled once
     against the sphere pose (the cloth solve is not a per-frame thing), its
     size fitted to that cavity. As the glass grows out of the sphere each
     vertex of the cloth goes with the wall in its own direction — the
     superformula is radial about its centre, so the wall is a radius per
     direction (buildWallMap) and the cloth keeps its place against it. */
  const vessel = useMemo(() => {
    const sphere = buildGlass(artifactForm, 0);
    const sheetSize = fitSheetSize(sphere);
    const t = VESSEL_TUNE;
    const sheet = buildDrapedSheet(sphere, t.inset, {
      sheetSize, anchorAngle: t.anchorAngle, anchorHeight: t.anchorHeight, tilt: t.tilt, contact: t.contact,
      sag: t.sag, peel: t.peel, curl: t.curl, twist: t.twist, gap: t.gap, soft: t.soft,
    });
    const rest = (sheet.geometry.getAttribute("position").array as Float32Array).slice();
    const wall0 = buildWallMap(sphere);
    const base = new Float32Array(rest.length / 3);
    for (let v = 0; v < base.length; v++) base[v] = wall0(rest[v * 3], rest[v * 3 + 1], rest[v * 3 + 2]);
    return { sheet, rest, base, normals: new Float32Array(rest.length), groundY: sphere.lo - 0.02, sphere };
  }, [bodyKey]);
  useEffect(() => () => { vessel.sheet.geometry.dispose(); vessel.sphere.geometry.dispose(); }, [vessel]);
  const followWall = () => {
    const wall = buildWallMap({ positions: artifact.geometry.getAttribute("position").array as Float32Array });
    const { sheet, rest, base } = vessel;
    const pos = sheet.geometry.getAttribute("position") as THREE.BufferAttribute;
    const out = pos.array as Float32Array;
    for (let v = 0; v < base.length; v++) {
      const x = rest[v * 3], y = rest[v * 3 + 1], z = rest[v * 3 + 2];
      const f = wall(x, y, z) / (base[v] || 1);
      out[v * 3] = x * f; out[v * 3 + 1] = y * f; out[v * 3 + 2] = z * f;
    }
    pos.needsUpdate = true;
    computeMeshNormals(out, sheet.geometry.index!.array, vessel.normals);
    const n = sheet.geometry.getAttribute("normal") as THREE.BufferAttribute;
    (n.array as Float32Array).set(vessel.normals);
    n.needsUpdate = true;
  };
  const writeMorph = (m: number, seconds = 0, snap = true) => {
    const { rest, geometry } = artifact;
    const out = geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = out.array as Float32Array;
    const settled = advanceArtifactPose(arr, targetPose, m, seconds, snap);
    if (settled) settledPose.current = targetPose;
    out.needsUpdate = true;
    computeMeshNormals(arr, rest.index, normals);
    const n = geometry.getAttribute("normal") as THREE.BufferAttribute;
    (n.array as Float32Array).set(normals);
    n.needsUpdate = true;
    written.current = settled ? m : -1;
    // The same sheet follows the actual intermediate glass, including when
    // rhythm changes the base radius while growth is near its minimum.
    followWall();
  };

  const waves = useKept(() => ({
    uTime: { value: 0 },
    uDrops: { value: Array.from({ length: POND_DROP_SLOTS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uTrails: { value: Array.from({ length: POND_TRAIL_SLOTS }, () => new THREE.Vector4()) },
    uTrailControls: { value: Array.from({ length: POND_TRAIL_SLOTS }, () => new THREE.Vector4()) },
    uTrailTimes: { value: Array.from({ length: POND_TRAIL_SLOTS }, () => new THREE.Vector2(-99, 0)) },
    uSheetDrop: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSheetShape: { value: new THREE.Vector4(1, 1, 1, 0) },
  }));
  const illumination = useKept(() => ({
    uAscentIncident: { value: 0 },
    uAscentRadiance: { value: 0 },
    uAscentBloom: { value: 0 },
    uAscentExposure: { value: 0 },
    uAscentHandoff: { value: 0 },
    uAscentAtmosphere: { value: 0 },
    uAscentRay: { value: 0 },
    uAscentRayFill: { value: 0 },
    uMemoryRadius: { value: 1 },
    uMemoryPosition: { value: FORM_AT.clone() },
  }));
  const under = useMemo(() => ({ value: 0 }), []);
  const water = useMemo(() => ({
    ...illumination,
    uWash: { value: 0 },
    uDescentShade: { value: 0 },
    uCeiling: { value: 0 },
    uAtmosphericLight: { value: 0 },
    uTint: { value: new THREE.Color("#a4b6be") },
    uTintAmount: { value: 0 },
    uClock: { value: 0 },
    uShapePush: { value: 0 },
    uShapeRay: { value: new THREE.Vector3(0, 0, -1) },
  }), []);
  const surfaceUniforms = useMemo(() => ({ ...waves, ...water }), [waves, water]);
  const volumeUniforms = useMemo(() => ({
    ...waves, ...water, uUnder: under,
    uInvProjection: { value: new THREE.Matrix4() },
    uCameraWorld: { value: new THREE.Matrix4() },
  }), [waves, water, under]);
  const filmUniforms = useKept(() => {
    // one seed for the strip's tears and stains and for where the light gets in
    const seed = Math.random() * 10;
    const look = filmLookUniforms();
    look.uFilmSeed.value = seed;
    return {
      ...waves,
      ...look,
      ...sheetUniforms(),
      // unexposed stock until a photo is chosen; the strip is whole from the start
      uPhoto: { value: BLANK_PHOTO as THREE.Texture },
      uDevelop: { value: 0 },
      uSize: { value: new THREE.Vector2(FILM_LENGTH, FILM_WIDTH) },
      uImageAspect: { value: 1 },
      uEdgePrint: { value: createEdgePrint(1 + Math.floor(Math.random() * 36)) },
      uFloat: { value: 0 },
      uSink: { value: 0 },
      uCurl: { value: 1 },
      uFlex: { value: 0 },
      uSeed: { value: seed },
      // starts fully dissolved, and gathers itself over EMERGE_S
      uDissolve: { value: 1.2 },
      uBelow: { value: WRAP_TUNE_DEFAULT.filmBelow },
      // the whole strip's alpha: 1 until the eye has gone under it, then it thins away for good
      uFade: { value: 1 },
    };
  });
  const motesUniforms = useMemo(() => ({
    uTime: waves.uTime, uUnder: under, uWash: water.uWash, uPixel: { value: gl.getPixelRatio() },
  }), [waves, water, under, gl]);
  /* The vessel's two materials. The refraction pass: everything on layer 0 —
     the water, the film, the motes, the sheet inside the glass — is drawn to a
     target the glass's walls then sample (FRONT_LAYER), displaced along their
     normals; the touch pass below takes the finished frame from there. */
  const refract = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { samples: RT_SAMPLES, type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false });
    const blit = new THREE.ShaderMaterial({
      vertexShader: backdropVertex, fragmentShader: blitFragment,
      uniforms: { tScene: { value: target.texture } },
      depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blit);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    return { target, blit, quad, scene };
  }, []);
  useEffect(() => () => { refract.target.dispose(); refract.blit.dispose(); refract.quad.geometry.dispose(); }, [refract]);
  // the strip inside is the strip that fell: the same seed for its tears and stains, the same edge print
  const sheetU = useKept(() => {
    const u = createSheetUniformSet(filmUniforms.uEdgePrint.value);
    u.uReveal.value = 0;
    u.uDevelop.value = PRINT_EARLY ? 1.45 : 0;
    return { ...u, ...illumination, uSurfaceLight: { value: 0 } };
  });
  const glassU = useMemo(() => {
    const u = createGlassUniformSet(refract.target.texture);
    u.uReveal.value = 0;
    return { ...u, ...illumination, uSurfaceLight: { value: 0 } };
  }, [refract]);
  const vesselTune = useMemo(() => ({ ...VESSEL_TUNE }), []);
  const vesselKey = useMemo(() => keyFrom(VESSEL_TUNE.keyAzimuth, VESSEL_TUNE.keyElevation), []);
  const vesselPatches = useMemo(() => seedDirections(filmUniforms.uSeed.value, 3, 1.1), [filmUniforms]);
  const writeVessel = (haze: number, above: THREE.Color, below: THREE.Color, fog: THREE.Color, arrivalHaze: number) => {
    vesselTune.haze = haze;
    // Arrival is water obscuring the body, not a luminous halo or a frosted surface.
    vesselTune.hazeGlow = VESSEL_TUNE.hazeGlow * (1 - arrivalHaze);
    vesselTune.hazeFrost = VESSEL_TUNE.hazeFrost * (1 - arrivalHaze);
    vesselTune.hazeShade = VESSEL_TUNE.hazeShade * (1 - arrivalHaze);
    Object.assign(vesselTune, vesselTint(stage.current.oklch));
    // the stain comes in with the colour step and stays on the glass after it: the water lets
    // the colour go on release, the memory keeps it
    vesselTune.memoryTintAmount *= smooth.current.stain;
    vesselTune.memoryFlash *= smooth.current.stain;
    const seed = filmUniforms.uSeed.value;
    const air = [fog.r, fog.g, fog.b] as const;
    writeSheetUniforms(sheetU, {
      tune: vesselTune, seed, sheet: vessel.sheet, sheetMode: "draped", face: "glass", key: vesselKey,
      edgePrint: filmUniforms.uEdgePrint.value, groundY: vessel.groundY, reflect: -1, air,
    });
    writeGlassUniforms(glassU, { tune: vesselTune, seed, key: vesselKey, patches: vesselPatches, room: VESSEL_ROOM, groundY: vessel.groundY, reflect: -1, air });
    glassU.uAboveColor.value.copy(above);
    glassU.uBelowColor.value.copy(below);
  };
  // the point cloud (only with ?cloud=1): its uniforms and material live in wrapCloud.ts
  const particleUniforms = useMemo(() => createCloudUniforms(WRAP_TUNE_DEFAULT), []);
  const particleMaterial = useMemo(() => createCloudMaterial(particleUniforms), [particleUniforms]);
  useEffect(() => () => particleMaterial.dispose(), [particleMaterial]);
  const [particleGeometry, setParticleGeometry] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => () => particleGeometry?.dispose(), [particleGeometry]);

  /* The touch pass: the scene is drawn to a target, then to the screen through
     the water around the hands. The quad copies the frame as it is where
     nothing bends it. */
  const ascentBloom = useMemo(createAscentBloom, []);
  const silhouetteBlur = useMemo(createSilhouetteBlur, []);
  useEffect(() => () => silhouetteBlur.dispose(), [silhouetteBlur]);
  useEffect(() => () => ascentBloom.dispose(), [ascentBloom]);
  const touch = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { samples: RT_SAMPLES, type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false });
    const material = new THREE.ShaderMaterial({
      vertexShader: touchVertex,
      fragmentShader: touchFragment,
      uniforms: {
        ...illumination,
        tScene: { value: target.texture },
        tAscentBloom: { value: ascentBloom.texture },
        tSoftScene: { value: silhouetteBlur.texture },
        uHand: { value: [new THREE.Vector2(-10, -10), new THREE.Vector2(-10, -10)] },
        uWake: { value: [new THREE.Vector2(), new THREE.Vector2()] },
        uPress: { value: [0, 0] },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uArrivalBlur: { value: 0 },
        uViewport: { value: new THREE.Vector2(1, 1) },
        uArrivalCenter: { value: new THREE.Vector2(.5, .5) },
      },
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { target, material, quad, scene, camera };
  }, []);
  useEffect(() => () => { touch.target.dispose(); touch.material.dispose(); touch.quad.geometry.dispose(); }, [touch]);
  useEffect(() => {
    const dpr = gl.getPixelRatio();
    const w = Math.max(1, Math.round(size.width * dpr)), h = Math.max(1, Math.round(size.height * dpr));
    touch.target.setSize(w, h);
    ascentBloom.resize(w, h);
    silhouetteBlur.resize(w, h);
    refract.target.setSize(w, h);
    touch.material.uniforms.uAspect.value = size.width / size.height;
    touch.material.uniforms.uViewport.value.set(size.width, size.height);
  }, [touch, refract, ascentBloom, silhouetteBlur, gl, size]);
  /* Three binds a material's uniform holders once, when its program is first
     acquired, and never reads `material.uniforms` again. A Fast Refresh (any
     save while the lab is open) recomputes every memo above, so the materials
     are handed new uniform objects and the new frame loop writes those — while
     the GPU keeps the holders from before, frozen at the pond's values: the
     water's underside stayed teal above the horizon and the volume stayed
     clear, the page showing through below it. Forgetting what the renderer
     kept for each material makes it bind the current holders on its next draw;
     the compiled programs are cached and are not rebuilt. Effects re-run on a
     refresh whatever their deps, so this runs then, and harmlessly at mount. */
  useEffect(() => {
    scene.traverse((o) => {
      const { material } = o as THREE.Mesh;
      if (material) gl.properties.remove(material);
    });
  }, [gl, scene]);
  /* The glass's shaders are heavy; compiled off the frame at mount, with the
     form shown for the moment it takes to collect them, so the form does not
     surface into a long frame. */
  useEffect(() => {
    const body = form.current;
    if (!body) return;
    const was = body.visible;
    body.visible = true;
    camera.layers.enableAll();
    const pending = gl.compileAsync(scene, camera).catch(() => undefined);
    body.visible = was;
    void pending;
  }, [gl, scene, camera]);
  useFrame(({ gl: renderer, scene, camera: view }) => {
    const body = form.current;
    if ((body && body.visible) || stage.current.step === "distance") {
      glassU.uResolution.value.set(refract.target.width, refract.target.height);
      view.layers.set(0);
      renderer.setRenderTarget(refract.target);
      renderer.render(scene, view);
      renderer.setRenderTarget(touch.target);
      renderer.render(refract.scene, touch.camera);
      renderer.clearDepth();
      view.layers.set(FRONT_LAYER);
      renderer.autoClear = false;
      renderer.render(scene, view);
      renderer.autoClear = true;
      view.layers.enableAll();
    } else {
      view.layers.enableAll();
      renderer.setRenderTarget(touch.target);
      renderer.render(scene, view);
    }
    if (touch.material.uniforms.uArrivalBlur.value > .05) {
      silhouetteBlur.render(renderer, touch.target.texture,
        touch.material.uniforms.uArrivalBlur.value * renderer.getPixelRatio());
    }
    if (illumination.uAscentBloom.value > .001) {
      ascentBloom.render(renderer, touch.target.texture, illumination.uAscentBloom.value);
    }
    renderer.setRenderTarget(null);
    renderer.render(touch.scene, touch.camera);
    // Read immediately after drawing, before WebGL releases its drawing buffer.
    if (stage.current.captureSurface) {
      const done = stage.current.captureSurface;
      stage.current.captureSurface = undefined;
      holdSurfaceFrame(renderer.domElement, false);
      done();
    }
  }, 1);

  /* On confirm, with ?cloud=1: the point cloud. The print itself needs nothing
     built — it develops into the strip already inside the glass (setDevelop). */
  const buildWrap = (filmMesh: THREE.Mesh, texture: THREE.Texture, size: THREE.Vector2) => {
    if (!CLOUD) return;
    const { rest } = artifact;
    setParticleGeometry(buildCloudGeometry({
      sphere: rest.sphere, vertexCount: rest.vertexCount, uv: buildPhotoUv(rest.sphere, MODEL_SPACE),
      positions: artifact.geometry.getAttribute("position").array as Float32Array,
      filmMesh, texture, stripSize: size,
      count: tune.current.cloudCount, releaseS: tune.current.releaseS,
    }));
  };
  const motes = useMemo(() => {
    const count = 700;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = -0.3 - Math.random() * 9;
      positions[i * 3 + 2] = -7 + Math.random() * 13;
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return geometry;
  }, []);

  const drop = (x: number, z: number, at: number, strength: number) => {
    waves.uDrops.value[dropIndex.current++ % POND_DROP_SLOTS].set(x, z, at, strength);
  };

  useFrame((_, delta) => {
    const tr = transport.current;
    const knobs = tune.current;
    const dt = tr.paused ? 0 : Math.min(delta, 0.05) * tr.speed;
    if (!document.hidden) time.current += dt;
    const s = stage.current;

    /* The seek. The wrap and the rise are functions of the time since
       confirm, so moving the clock is enough — except for what latched on the
       way: the wrap's end, the rise's start and end, the film hidden, the
       surface broken. Those are set to where the target time would have them. */
    const wrapEnds = wrapEndsFor(knobs);
    tr.length = wrapEnds + RISE_S + 0.5;
    tr.active = wrapAt.current !== null;
    if (tr.seek !== null && wrapAt.current !== null) {
      const target = Math.min(tr.length, Math.max(0, tr.seek));
      tr.seek = null;
      time.current = wrapAt.current + target;
      if (target < wrapEnds) {
        if (wrapped.current) {
          wrapped.current = false;
          riseAt.current = null; risen.current = false; broke.current = false;
          s.rise = false;
          onRewound("wrapping");
        }
      } else {
        if (!wrapped.current) {
          wrapped.current = true;
          s.rise = true;
          onWrapped();
        }
        riseAt.current = wrapAt.current + wrapEnds;
        const k = (target - wrapEnds) / RISE_S;
        broke.current = k >= 1;
        if (k < 1 && risen.current) { risen.current = false; onRewound("rising"); }
      }
    }
    const t = time.current;
    waves.uTime.value = t;
    tr.shot = wrapAt.current === null ? 0 : t - wrapAt.current;

    /* Resume color / ?from=wrap: the first frame is set up as the end of the color step —
       the photo developed and the strip afloat, the descent long over, the
       form surfaced with its shape and mist, the water washed — and only the lab wrap
       begins a new animation on it. Everything timed from these marks reads as finished. */
    if (s.request && (s.request.restore || (from !== null && !jumped.current)) && film.current && form.current) {
      jumped.current = true;
      const longAgo = t - 60;
      const request = s.request;
      s.request = null;
      const image = request.texture.image as { width: number; height: number };
      filmUniforms.uPhoto.value = prepareFilmPhoto(request.texture);
      filmUniforms.uImageAspect.value = image.width / image.height;
      sheetU.uPhoto.value = filmUniforms.uPhoto.value;
      sheetU.uImageAspect.value = filmUniforms.uImageAspect.value;
      filmUniforms.uDevelop.value = 1.45;
      filmUniforms.uDissolve.value = 0;
      filmUniforms.uFloat.value = 1;
      filmUniforms.uCurl.value = 0.7;
      filmUniforms.uSink.value = 1;
      developAt.current = longAgo;
      fall.current = {
        at: longAgo, pos: FILM_AT.clone(), quat: scratch.flat.clone(),
        right: new THREE.Vector3(1, 0, 0), width: FILM_LENGTH, height: FILM_WIDTH, flex: 0, rippled: true,
      };
      landedAt.current = longAgo;
      settled.current = true;
      filmGone.current = 1;
      hold.current = 1;
      descentAt.current = longAgo;
      reachedBottom.current = true;
      smooth.current.wash = WATER_WASH;
      smooth.current.dye = 1;
      smooth.current.morph = s.morph;
      smooth.current.frost = s.frost;
      writeMorph(s.morph);
      water.uTintAmount.value = 1;
      s.wrap = !request.restore && from === "wrap";
    }

    if (s.view !== null) {
      if (s.view !== "underwater") {
        descentAt.current = null;
        reachedBottom.current = false;
        hold.current = 0;
        wasHolding.current = false;
        s.holding = false;
        filmGone.current = 0;
        filmUniforms.uFade.value = 1;
        filmUniforms.uSink.value = 0;
        wrapAt.current = null; wrapped.current = false;
        riseAt.current = null; risen.current = false; broke.current = false;
        s.wrap = false; s.rise = false;
        if (s.view === "choose") {
          // Reopen the empty hanging strip, keeping this canvas and water clock.
          jumped.current = true;
          photoAt.current = null;
          developAt.current = null;
          fall.current = null;
          landedAt.current = null;
          settled.current = false;
          filmUniforms.uPhoto.value = BLANK_PHOTO;
          sheetU.uPhoto.value = BLANK_PHOTO;
          filmUniforms.uDevelop.value = 0;
          filmUniforms.uFloat.value = 0;
          filmUniforms.uCurl.value = 1;
          smooth.current.wash = 0;
          smooth.current.dye = 0;
        }
      } else {
        // A history return skips the arrival, retaining the handled artifact.
        descentAt.current ??= t - 60;
        reachedBottom.current = true;
        filmGone.current = 1;
        hold.current = 1;
        filmUniforms.uSink.value = 1;
      }
      s.view = null;
    }

    /* The camera, in order: still on the pond; down the descent path; drawn
       back for the wrap; up the rise path; still again, on the named memory. */
    const { cameraAt, lookAt, formAt } = scratch;
    formAt.copy(FORM_AT);
    if (descentAt.current !== null && wrapAt.current === null && riseAt.current === null) {
      const ascent = smoothProgress(t - descentAt.current, FORM_ASCENT_S[0], FORM_ASCENT_S[1]);
      formAt.y -= (1 - ascent) * FORM_ASCENT_HEIGHT;
    }
    filmUniforms.uBelow.value = knobs.filmBelow;
    // the wrap's framing is live from the panel; the rise sets out from wherever it is
    scratch.wrapCamera.set(0, knobs.cameraY, knobs.cameraZ);
    scratch.wrapLook.set(0, knobs.lookY, knobs.lookZ);
    scratch.wrapForm.set(0, knobs.formY, knobs.formZ);
    if (riseAt.current === null) RISE_FORM.points[0].copy(scratch.wrapForm);
    if (riseAt.current !== null) {
      const k = Math.min(1, (t - riseAt.current) / RISE_S);
      // it slows as it nears the surface, comes up gently past its seat and settles back
      const climb = NAME_FORM_AT.y - scratch.wrapForm.y;
      const surface = -scratch.wrapForm.y / climb;
      const u = riseProgress(k, surface, knobs.riseSurfaceAt, knobs.riseBob / Math.max(0.2, NAME_FORM_AT.y));
      formAt.copy(RISE_FORM.getPoint(Math.min(1, u)));
      if (u > 1) formAt.y += (u - 1) * climb;
      // the eye follows: it keeps the offset it had to the form at the wrap and goes up with it,
      // looking at the form itself (the wrap's look was a little under it), lifting a little as it nears the surface
      const toForm = smoothProgress(k, 0, 0.35);
      const lift = knobs.riseAbove * smoothProgress(k, 0.1, knobs.riseViewUntil);
      cameraAt.copy(scratch.wrapCamera).sub(scratch.wrapForm).add(formAt);
      cameraAt.y += lift;
      lookAt.copy(scratch.wrapLook).sub(scratch.wrapForm).multiplyScalar(1 - toForm).add(formAt);
      // and as the form comes up through the surface the eye eases over to the pond view, where it is named
      const settle = smoothProgress(k, knobs.riseViewUntil, Math.max(knobs.riseViewUntil + 0.05, knobs.riseViewBack));
      cameraAt.lerp(POND_CAMERA, settle);
      lookAt.lerp(POND_LOOK, settle);
      if (k >= 1 && !risen.current) { risen.current = true; onRisen(); }
    } else if (wrapAt.current !== null) {
      const k = flowProgress(t - wrapAt.current, 0, WRAP_MOVE_S);
      cameraAt.copy(DESCENT_PATH.getPoint(1)).lerp(scratch.wrapCamera, k);
      lookAt.copy(DESCENT_LOOK.getPoint(1)).lerp(scratch.wrapLook, k);
      formAt.lerp(scratch.wrapForm, k);
    } else if (descentAt.current === null) {
      if (pond) pondCameraPose(pond.arrival, 0, null, cameraAt, lookAt);
      else { cameraAt.copy(POND_CAMERA); lookAt.copy(POND_LOOK); }
    } else {
      const k = Math.min(1, (t - descentAt.current) / DESCENT_S);
      const u = flowProgress(k, 0, 1);
      cameraAt.copy(DESCENT_PATH.getPoint(u));
      lookAt.copy(DESCENT_LOOK.getPoint(u));
      if (t - descentAt.current >= Math.max(DESCENT_S, FORM_ASCENT_S[1]) && !reachedBottom.current) {
        reachedBottom.current = true; onUnder();
      }
    }
    // The ascent: after the release, eye and form float up together toward the
    // surface — the same framing, carried up into the light under the ceiling.
    if (s.ascend && ascendAt.current === null && wrapAt.current === null && riseAt.current === null) ascendAt.current = t;
    if (!s.ascend) { ascendAt.current = null; ascended.current = false; }
    let ascentProgress = 0;
    if (ascendAt.current !== null) {
      const k = Math.min(1, (t - ascendAt.current) / ASCEND_S);
      const u = k * k * (3 - 2 * k);
      const lift = u * Math.max(0, ASCEND_TO_Y - cameraAt.y);
      cameraAt.y += lift; lookAt.y += lift; formAt.y += lift;
      ascentProgress = k;
      if (k >= 1 && !ascended.current) { ascended.current = true; onAscended(); }
    }
    gl.domElement.dataset.ascentProgress = ascentProgress.toFixed(2);
    const light = ascentLightAt(ascentProgress);
    illumination.uAscentIncident.value = light.incident;
    illumination.uAscentRadiance.value = light.radiance;
    illumination.uAscentAtmosphere.value = light.atmosphere;
    illumination.uAscentRay.value = light.ray;
    illumination.uAscentRayFill.value = light.rayFill;
    illumination.uAscentBloom.value = light.bloom;
    illumination.uAscentExposure.value = light.exposure;
    illumination.uAscentHandoff.value = light.handoff;
    // the orbit: once the wrap has begun, the view can be turned about its look point to watch from another
    // side; it is let go over the rise's crossing to the pond view, so the named memory is seen from the pond
    let yawDeg = knobs.orbitYaw, pitchDeg = knobs.orbitPitch;
    if (riseAt.current !== null) {
      const k = Math.min(1, (t - riseAt.current) / RISE_S);
      const held = 1 - smoothProgress(k, knobs.riseViewUntil, Math.max(knobs.riseViewUntil + 0.05, knobs.riseViewBack));
      yawDeg *= held; pitchDeg *= held;
    }
    if (wrapAt.current !== null && (yawDeg !== 0 || pitchDeg !== 0)) {
      const offset = scratch.v.copy(cameraAt).sub(lookAt);
      const yaw = THREE.MathUtils.degToRad(yawDeg);
      const pitch = THREE.MathUtils.degToRad(pitchDeg);
      const flat = Math.hypot(offset.x, offset.z);
      const heading = Math.atan2(offset.x, offset.z) + yaw;
      const elevation = Math.min(1.45, Math.max(-1.45, Math.atan2(offset.y, flat) + pitch));
      const r = offset.length();
      cameraAt.set(lookAt.x + r * Math.cos(elevation) * Math.sin(heading), lookAt.y + r * Math.sin(elevation), lookAt.z + r * Math.cos(elevation) * Math.cos(heading));
    }
    // Open the lens for the constellation while holding the current artifact's
    // apparent size. A matching dolly changes perspective, never mesh scale.
    const lens = camera as THREE.PerspectiveCamera;
    lens.fov += ((s.step === "distance" ? 72 : 48) - lens.fov) * (1 - Math.exp(-4 * dt));
    if (Math.abs(lens.fov - 48) < .001) lens.fov = 48;
    lens.updateProjectionMatrix();
    const lensDolly = Math.tan(THREE.MathUtils.degToRad(24)) / Math.tan(THREE.MathUtils.degToRad(lens.fov / 2));
    cameraAt.sub(lookAt).multiplyScalar(lensDolly).add(lookAt);
    camera.position.copy(cameraAt);
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
    // Recording uses this same water, including its voice-driven ripples.
    for (const pulse of s.voicePulses.splice(0)) {
      voiceNdc.set(pulse.x * 2 - 1, 1 - pulse.y * 2);
      voiceRay.setFromCamera(voiceNdc, camera);
      if (voiceRay.ray.intersectPlane(voicePlane, voicePoint) && voicePoint.z > -100 && voicePoint.z < 18) {
        drop(voicePoint.x, voicePoint.z, t, pulse.strength * (pulse.soft ? -1 : 1));
      }
    }

    /* The water lets go of its color while the form is being handled, and
       takes it back as the form leaves. The color pick weathers it faintly. */
    const sm = smooth.current;
    const ease = (from: number, to: number, rate: number) => from + (to - from) * (1 - Math.exp(-rate * dt));
    // in with the form as it surfaces at the end of the descent; out again over the rise
    const washIn = descentAt.current === null ? 0 : smoothProgress(t - descentAt.current, WASH_IN_S[0], WASH_IN_S[1]);
    // Follow the shot's easing directly: another lag here delayed the light
    // background until after the form had finished surfacing.
    sm.wash = riseAt.current !== null || s.release ? ease(sm.wash, 0, .55) : WATER_WASH * washIn;
    sm.ceiling = ease(sm.ceiling, s.release ? 1 : 0, 0.7);
    water.uCeiling.value = sm.ceiling;
    // A faint precursor is already drifting during colour. Continue extends
    // it through a 2.6-second smooth entrance rather than switching rays on.
    const atmosphericTarget = s.release ? .08 + .92 * light.shafts
      : s.step === "color" ? .08 : 0;
    sm.atmospheric = ease(sm.atmospheric, atmosphericTarget, 2);
    water.uAtmosphericLight.value = sm.atmospheric;
    water.uWash.value = sm.wash;
    // Both the underside and the full-frame water share this brief darker tone.
    // It is gone by the pale wash's end, before the form finishes climbing.
    water.uDescentShade.value = descentAt.current === null ? 0
      : DESCENT_SHADE * (1 - smoothProgress(t - descentAt.current, FORM_REVEAL_S[0], WASH_IN_S[1]));
    water.uClock.value = t;
    glassU.uSurfaceLight.value = s.surfaceLight;
    sheetU.uSurfaceLight.value = s.surfaceLight;
    const colorStep = (s.step === "color" && !s.release) || wrapAt.current !== null;
    sm.dye = ease(sm.dye, colorStep ? 1 : 0, 1.6);
    // the pick reaches the water as a faint, light tint — a cloud's worth, not a dye
    tint.set(oklchToHex({ l: Math.max(0.9, s.oklch.l), c: s.oklch.c * 0.45, h: s.oklch.h }));
    water.uTint.value.lerp(tint, 1 - Math.exp(-3 * dt));
    water.uTintAmount.value = ease(water.uTintAmount.value, colorStep ? 1 : 0, 1.4);
    sm.stain = ease(sm.stain, colorStep || s.release ? 1 : 0, 1.4);
    volumeUniforms.uInvProjection.value.copy(camera.projectionMatrixInverse);
    volumeUniforms.uCameraWorld.value.copy(camera.matrixWorld);

    const camY = camera.position.y;
    // Prevent the HTML background showing through the body while the surface
    // stays opaque in the final underwater frames.
    under.value = Math.max(1 - smoothProgress(camY, -1.15, 0.12), smoothProgress(sm.ceiling, 0, .3));
    // the film is passed through on the way down and left behind: it thins away under the eye and stays gone
    if (film.current && descentAt.current !== null) {
      filmGone.current = Math.max(filmGone.current, smoothProgress(-camY, FILM_GONE_DEPTH[0], FILM_GONE_DEPTH[1]));
      filmUniforms.uFade.value = 1 - filmGone.current;
      film.current.visible = filmGone.current < 0.999;
    }

    /* The hands in the water. Each slot follows its hand with a little lag
       and keeps the hand's motion as a wake; a hand that leaves fades where it
       was. The left hand keeps the left slot, so two hands never swap. */
    const tu = touch.material.uniforms;
    const hands = s.hands.length > 1 ? [...s.hands].sort((a, b) => a.x - b.x) : s.hands;
    for (let i = 0; i < 2; i++) {
      const slot = touches.current[i];
      const hand = hands[i];
      if (hand) {
        if (slot.press < 0.01) { slot.at.set(hand.x, hand.y); slot.wake.set(0, 0); }
        const k = 1 - Math.exp(-9 * dt);
        const dx = (hand.x - slot.at.x) * k, dy = (hand.y - slot.at.y) * k;
        slot.at.x += dx; slot.at.y += dy;
        // the wake is the smoothed motion, in frame-widths per second, held back by the water
        if (dt > 0) {
          const kw = 1 - Math.exp(-4 * dt);
          slot.wake.x += ((dx / dt) * 0.02 - slot.wake.x) * kw;
          slot.wake.y += ((dy / dt) * 0.02 - slot.wake.y) * kw;
          if (slot.wake.length() > 0.025) slot.wake.setLength(0.025);
        }
        slot.press = ease(slot.press, 1, 5);
      } else {
        slot.press = ease(slot.press, 0, 3);
        slot.wake.multiplyScalar(Math.exp(-3 * dt));
      }
      (tu.uHand.value as THREE.Vector2[])[i].copy(slot.at);
      (tu.uWake.value as THREE.Vector2[])[i].copy(slot.wake);
      (tu.uPress.value as number[])[i] = slot.press;
    }
    tu.uTime.value = t;
    // only while the form is in hand, and only under the water
    tu.uAmount.value = ease(tu.uAmount.value, s.step !== null ? under.value * UNDERWATER_TOUCH.intensity : 0, 2.5);
    if (glowRef.current) glowRef.current.style.opacity = String(1 - under.value);
    if (crossingRef.current) {
      const crossing = descentAt.current === null ? 0 : Math.exp(-((camY / 0.28) ** 2));
      crossingRef.current.style.opacity = String(crossing);
      crossingRef.current.style.backdropFilter = `blur(${(crossing * 14).toFixed(1)}px)`;
      crossingRef.current.style.setProperty("-webkit-backdrop-filter", `blur(${(crossing * 14).toFixed(1)}px)`);
    }

    /* The strip, before it is let go: it gathers itself out of nothing in
       front of the view and hangs there, empty, turning a little on the air.
       The photo develops into its window; a beat later the hand opens. */
    const mesh = film.current;
    if (!s.photoReady) photoAt.current = null;
    else if (photoAt.current === null) photoAt.current = t;
    if (mesh) mesh.visible = s.photoReady && filmGone.current < .999;
    if (mesh && s.photoReady && fall.current === null) {
      filmUniforms.uDissolve.value = 1.2 * (1 - smoothProgress(t - (photoAt.current ?? t), EMERGE_S[0], EMERGE_S[1]));
      camera.getWorldDirection(scratch.forward);
      scratch.v.set(0, 1, 0).applyQuaternion(camera.quaternion);
      mesh.position.copy(camera.position).addScaledVector(scratch.forward, CHOOSE_DEPTH)
        .addScaledVector(scratch.v, -0.12 + 0.025 * Math.sin(t * 0.7));
      scratch.euler.set(-0.08 + 0.05 * Math.sin(t * 0.5), 0.06 * Math.sin(t * 0.37 + 1.0), 0.03 * Math.sin(t * 0.43), "YXZ");
      mesh.quaternion.copy(camera.quaternion).multiply(scratch.flutter.setFromEuler(scratch.euler));
      filmUniforms.uFlex.value = 0.08 * Math.sin(t * 0.8);
      const request = s.request;
      if (request) {
        s.request = null;
        const image = request.texture.image as { width: number; height: number };
        filmUniforms.uPhoto.value = prepareFilmPhoto(request.texture);
        filmUniforms.uImageAspect.value = image.width / image.height;
        // the same picture waits in the strip inside the glass, to come up at the wrap
        sheetU.uPhoto.value = filmUniforms.uPhoto.value;
        sheetU.uImageAspect.value = filmUniforms.uImageAspect.value;
        developAt.current = t;
      }
      if (developAt.current !== null) {
        const since = t - developAt.current;
        filmUniforms.uDevelop.value = 1.45 * smoothProgress(since, 0, DEVELOP_S);
        if (since >= LET_GO_S) {
          fall.current = {
            at: t,
            pos: mesh.position.clone(),
            quat: mesh.quaternion.clone(),
            right: new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
            width: FILM_LENGTH,
            height: FILM_WIDTH,
            flex: filmUniforms.uFlex.value,
            rippled: false,
          };
          onFallStart();
        }
      }
      // the pick button rides the strip
      const pick = pickRef.current;
      if (pick) {
        scratch.v.copy(mesh.position).project(camera);
        const cx = (scratch.v.x * 0.5 + 0.5) * size.width, cy = (-scratch.v.y * 0.5 + 0.5) * size.height;
        scratch.v.set(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(FILM_LENGTH * 0.5).add(mesh.position).project(camera);
        const hw = Math.abs((scratch.v.x * 0.5 + 0.5) * size.width - cx);
        scratch.v.set(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(FILM_WIDTH * 0.5).add(mesh.position).project(camera);
        const hh = Math.abs((-scratch.v.y * 0.5 + 0.5) * size.height - cy);
        pick.style.transform = `translate(-50%, -50%) translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
        pick.style.width = `${(hw * 2).toFixed(1)}px`;
        pick.style.height = `${(hh * 2).toFixed(1)}px`;
      }
    }

    /* The fall: from where it hung to the water, fluttering, settling flat.
       Everything starts from rest — the hand opens, the strip begins to sink
       before the air takes it. The drop leads and the drift away over the
       water follows, so it is seen falling, not blown off; the flutter swells
       in as it gathers speed and dies out before it touches. */
    const f = fall.current;
    if (f && mesh) {
      const k = Math.min(1, (t - f.at) / FALL_S);
      const phase = (t - f.at) * 2.7;
      const air = smoothProgress(k, 0, 0.3) * (1 - k) ** 1.6;
      const sink = k * k * (3 - 2 * k);
      mesh.position.lerpVectors(f.pos, FILM_AT, smoothProgress(k, 0.1, 1));
      mesh.position.y = THREE.MathUtils.lerp(f.pos.y, FILM_AT.y, sink);
      mesh.position.addScaledVector(f.right, 0.26 * Math.sin(phase) * air);
      scratch.q.copy(f.quat).slerp(scratch.flat, smoothProgress(k, 0.08, 0.9));
      scratch.euler.set(0.5 * Math.sin(phase + 0.9) * air, 0, 0.36 * Math.sin(phase) * air, "XYZ");
      mesh.quaternion.copy(scratch.q).multiply(scratch.flutter.setFromEuler(scratch.euler));
      // the curl flexes with the air on the way down; the water presses some of it out
      filmUniforms.uCurl.value = 1 - 0.3 * filmUniforms.uFloat.value;
      filmUniforms.uFlex.value = f.flex * (1 - smoothProgress(k, 0, 0.25))
        + 0.6 * Math.sin(phase + 1.7) * air;
      if (!f.rippled && t - f.at >= FALL_S - RIPPLE_LEAD_S) {
        f.rippled = true;
        drop(FILM_AT.x, FILM_AT.z, t, 1.6);
        drop(FILM_AT.x - f.width * 0.45, FILM_AT.z + f.height * 0.3, t + 0.12, 0.5);
        drop(FILM_AT.x + f.width * 0.4, FILM_AT.z - f.height * 0.35, t + 0.2, 0.4);
      }
      if (k >= 1 && landedAt.current === null) landedAt.current = t;
    }

    if (landedAt.current !== null) {
      filmUniforms.uFloat.value = smoothProgress(t - landedAt.current, 0, 0.6);
      if (!settled.current && t - landedAt.current > SETTLE_S) { settled.current = true; onSettled(); }
    }

    if (s.photoReady && settled.current && descentAt.current === null) {
      if (s.holding && !wasHolding.current) drop(FILM_AT.x, FILM_AT.z, t, 0.55);
      wasHolding.current = s.holding;
      hold.current = s.holding
        ? Math.min(1, hold.current + dt / HOLD_S)
        : Math.max(0, hold.current - dt / 0.5);
      filmUniforms.uSink.value = smoothProgress(hold.current, 0, 1);
      if (hold.current >= 1) {
        descentAt.current = t;
        drop(FILM_AT.x, FILM_AT.z, t, 1.1);
        onDescend();
      }
    }

    /* The form. Its three signals follow the page's values with a little lag,
       the way the gesture pages smooth MediaPipe; growth is written to the
       geometry only when it has actually moved. The distance step is the
       vessel's haze; the colour pick reaches the glass through the room it
       reflects, as it reaches the water. */
    const body = form.current;
    const handlingSeat = size.width <= 600 ? UNDERWATER_PHONE.artifactDrop : HANDLING_DROP;
    const handlingTarget = riseAt.current !== null ? 0
      : wrapAt.current !== null ? handlingSeat * (1 - flowProgress(t - wrapAt.current, 0, WRAP_MOVE_S))
      : s.step ? handlingSeat : 0;
    if (handlingDrop.current === null) handlingDrop.current = s.step ? handlingSeat : 0;
    if (wrapAt.current === null && riseAt.current === null) {
      handlingDrop.current += (handlingTarget - handlingDrop.current) * (1 - Math.exp(-3 * dt));
    } else handlingDrop.current = handlingTarget;
    if (body && Math.abs(handlingDrop.current) > 0.0005) {
      const dist = Math.max(0.1, camera.position.distanceTo(formAt));
      scratch.forward.set(0, -1, 0).applyQuaternion(camera.quaternion);
      formAt.addScaledVector(scratch.forward, handlingDrop.current * 2 * dist * viewHalfTan(camera as THREE.PerspectiveCamera));
    }
    if (body) {
      const reveal = descentAt.current === null ? 0
        : smoothProgress(t - descentAt.current, FORM_REVEAL_S[0], FORM_REVEAL_S[1]);
      // Focus follows the climb, independently of the user's saved distance.
      // It reaches exactly zero at the final seat, before shaping starts.
      const arrivalHaze = descentAt.current === null || wrapAt.current !== null || riseAt.current !== null ? 0
        : 1 - smoothProgress(t - descentAt.current, FORM_ASCENT_S[0], FORM_ASCENT_S[1]);
      touch.material.uniforms.uArrivalBlur.value = reveal > .001 ? Math.max(28 * arrivalHaze, light.blur) : 0;
      scratch.v.copy(formAt).project(camera);
      touch.material.uniforms.uArrivalCenter.value.set(scratch.v.x * .5 + .5, scratch.v.y * .5 + .5);
      body.visible = reveal > 0.001;
      const previousMorph = sm.morph;
      sm.morph = ease(sm.morph, s.morph, 7);
      const morphVelocity = s.step === "shape" && dt > 0 ? (sm.morph - previousMorph) / dt : 0;
      const rhythmVelocity = s.step === "rhythm" && dt > 0 ? (artifactForm.side.m - previousM2.current) / dt : 0;
      previousM2.current = artifactForm.side.m;
      water.uShapePush.value = ease(water.uShapePush.value, THREE.MathUtils.clamp(morphVelocity * 1.8 + rhythmVelocity * .08, -1, 1), 4);
      water.uShapeRay.value.copy(formAt).sub(camera.position).normalize();
      sm.frost = ease(sm.frost, s.frost, 7);
      const visibleHaze = Math.max(sm.frost, arrivalHaze);
      if (settledPose.current !== targetPose || Math.abs(sm.morph - written.current) > 0.0015) {
        writeMorph(sm.morph, delta, false);
      }
      const air = 1 - smoothProgress(-formAt.y, -0.2, 0.3);
      const { roomAbove, roomBelow, roomAir } = scratch;
      roomAbove.copy(ROOM_WATER_ABOVE).lerp(ROOM_PAPER_ABOVE, sm.wash).lerp(ROOM_SKY, air);
      roomBelow.copy(ROOM_WATER_BELOW).lerp(ROOM_PAPER_BELOW, sm.wash).lerp(ROOM_SURFACE, air);
      const dye = water.uTintAmount.value * 0.06;
      roomAbove.lerp(water.uTint.value, dye);
      roomBelow.lerp(water.uTint.value, dye);
      // Match arrival fog to the water behind the rising body instead of
      // filling its silhouette with the brighter overhead reflection colour.
      scratch.v.copy(formAt).sub(camera.position).normalize();
      roomAir.copy(roomBelow).lerp(roomAbove, smoothProgress(scratch.v.y, -.8, .7))
        .multiplyScalar(1 - water.uDescentShade.value)
        .lerp(roomAbove, 1 - arrivalHaze);
      // the refraction's bend and smear are fractions of the screen, tuned with the vessel
      // filling the lab's view; here it is smaller on screen, so they scale with its size
      // or the picture inside would be smeared several times as much
      const cam = camera as THREE.PerspectiveCamera;
      const onScreen = body.scale.x / (Math.max(0.1, cam.position.distanceTo(body.position)) * viewHalfTan(cam));
      const sizeK = Math.min(1.5, Math.max(0.15, onScreen / LAB_ON_SCREEN));
      vesselTune.bend = VESSEL_TUNE.bend * sizeK;
      vesselTune.glassSoft = VESSEL_TUNE.glassSoft * sizeK;
      writeVessel(visibleHaze, roomAbove, roomBelow, roomAir, arrivalHaze);
      // The preview travels on the slider's own share, so its far end leaves only the deepest neighbours
      distanceDepth.current = memoryDepth(Math.min(1, sm.frost / DISTANCE_MAX) * PREVIEW_TRAVEL);
      sheetU.uReveal.value = reveal;
      glassU.uReveal.value = reveal;
      glassU.uTime.value = t;
      if (mist.current) mist.current.visible = visibleHaze * (vesselTune.hazeMist + vesselTune.hazeGlow) > 0.002;
      // one slow drift throughout, quieting as it comes to rest on the surface (a change of rhythm at the naming read as a jolt)
      const calm = riseAt.current === null ? 0 : smoothProgress((t - riseAt.current) / RISE_S, 0.6, 1);
      const bob = Math.sin(t * 0.6) * (0.05 - 0.02 * calm);
      body.position.set(formAt.x, formAt.y + bob, formAt.z);
      distanceAnchor.current.copy(body.position);
      // Far & faded also steps the memory back along its line of sight, so it keeps its place on screen and
      // only grows smaller; the constellation stays measured from the seat it left
      const handling = wrapAt.current === null && riseAt.current === null && !s.release;
      sm.recede = ease(sm.recede, handling ? Math.min(1, sm.frost / DISTANCE_MAX) : 0, 3);
      if (sm.recede > 1e-4) {
        scratch.v.copy(body.position).sub(camera.position);
        body.position.addScaledVector(scratch.v, DISTANCE_RECEDE * smoothProgress(sm.recede, 0, 1));
      }
      // Hold the handled memory at the same apparent size. The constellation
      // moves past it as the chosen gallery depth increases.
      body.traverse(child => {
        if (child instanceof THREE.Mesh && child.layers.isEnabled(FRONT_LAYER)) {
          child.userData.normalOrder ??= child.renderOrder;
          child.renderOrder = s.step === "distance" ? 100 - FIELD_FOCAL * 2 + (child === glassMesh.current ? -.1 : 0) : child.userData.normalOrder;
        }
      });
      // for the wrap the form fills out — about twice its volume — and stays that size up through the rise
      const grown = wrapAt.current === null ? 0 : flowProgress(t - wrapAt.current, 0, WRAP_MOVE_S);
      body.scale.setScalar(0.9 * (1 + knobs.grow * grown));
      // while it is handled, wrapped and rising it holds with the picture toward the eye, as the gallery
      // seats it (a slow turn would carry the picture away); once named it turns slowly
      if (!risen.current) {
        const home = OPEN_YAW + Math.round((body.rotation.y - OPEN_YAW) / (Math.PI * 2)) * Math.PI * 2;
        body.rotation.y = ease(body.rotation.y, home, 2.2);
      } else body.rotation.y += dt * 0.08;
      body.updateMatrixWorld();
      illumination.uMemoryPosition.value.copy(body.position);
      illumination.uMemoryRadius.value = targetPose.radius * body.scale.x;
    }

    /* The wrap: the film lets go of its image from the top down and the print
       develops into the strip inside the glass. With ?cloud=1 the image falls as points between. */
    if (s.wrap && wrapAt.current === null && mesh && body && filmUniforms.uPhoto.value) {
      wrapAt.current = t;
      buildWrap(mesh, filmUniforms.uPhoto.value, filmUniforms.uSize.value);
    }
    if (wrapAt.current !== null) {
      // the print develops into the strip inside the glass on the wrap's clock, into the rise if it
      // runs that long: darks first (?print=wrap only; the default has the picture there already)
      const clock = t - wrapAt.current - WRAP_MOVE_S * 0.5;
      setDevelop(sheetU, smoothProgress(clock, knobs.overlayIn, Math.max(knobs.overlayIn + 0.1, knobs.overlayOut)));
    }
    if (wrapAt.current !== null && !wrapped.current) {
      const clock = t - wrapAt.current - WRAP_MOVE_S * 0.5;
      if (CLOUD) {
        const pu = particleUniforms;
        pu.uClock.value = clock;
        // the knobs, every frame, so a slider moves the cloud that is already in the water
        setCloudUniforms(pu, particleMaterial, knobs, gl.getPixelRatio(), mesh ? mesh.position : null);
        if (body) { pu.uForm.value.copy(body.matrixWorld); pu.uFormAt.value.copy(body.position); }
      }
      // the rise follows the draw-back directly; nothing is held between
      if (t - wrapAt.current >= wrapEnds) {
        wrapped.current = true;
        onWrapped();
      }
    } else if (body && CLOUD) {
      particleUniforms.uForm.value.copy(body.matrixWorld);
      particleUniforms.uFormAt.value.copy(body.position);
      // points still in the water when the wrap was called finish their way
      if (wrapAt.current !== null) particleUniforms.uClock.value = t - wrapAt.current - WRAP_MOVE_S * 0.5;
    }

    /* The rise. The surface breaks once, where the form comes up through it. */
    if (s.rise && riseAt.current === null && wrapped.current) riseAt.current = t;
    if (riseAt.current !== null && !broke.current && body && body.position.y > -0.05) {
      broke.current = true;
      drop(body.position.x, body.position.z, t, 1.5);
      drop(body.position.x + 0.5, body.position.z + 0.3, t + 0.25, 0.5);
      drop(body.position.x - 0.4, body.position.z - 0.3, t + 0.4, 0.4);
    }

    /* The caption sits under the memory, wherever it has floated to. */
    const caption = captionRef.current;
    if (caption && body) {
      scratch.v.copy(body.position).add(scratch.forward.set(0, -0.78 * body.scale.x - 0.25, 0)).project(camera);
      caption.style.transform = `translate(-50%, 0) translate(${((scratch.v.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-scratch.v.y * 0.5 + 0.5) * size.height).toFixed(1)}px)`;
    }

    /* The hold line sits beside the photo, level with it, wherever it has floated:
       to its right, or to its left where the right has no room. */
    const hint = hintRef.current;
    const strip = film.current;
    if (hint && strip?.visible) {
      strip.updateMatrixWorld();
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        scratch.v.set(sx * FILM_LENGTH * 0.5, sy * FILM_WIDTH * 0.5, 0).applyMatrix4(strip.matrixWorld).project(camera);
        const x = (scratch.v.x * 0.5 + 0.5) * size.width, y = (-scratch.v.y * 0.5 + 0.5) * size.height;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      const gap = 28;
      // an upright phone has no room beside the strip: the line goes under it, wider
      const beside = size.width / size.height >= .8;
      hint.style.maxWidth = beside ? "min(20em, 40vw)" : "min(20em, calc(100vw - 48px))";
      const w = hint.offsetWidth;
      // the lab's knobs panel covers the right of the canvas; the line keeps out from under it
      const covered = document.querySelector("[data-covers-right]")?.getBoundingClientRect().left ?? size.width;
      const onRight = right + gap + w <= Math.min(size.width, covered) - 24;
      if (!beside) {
        const x = Math.min(size.width - 24 - w, Math.max(24, (left + right) / 2 - w / 2));
        hint.style.transform = `translate(${x.toFixed(1)}px, ${(bottom + gap).toFixed(1)}px)`;
        hint.style.textAlign = "center";
      } else {
        const x = onRight ? right + gap : Math.max(24, left - gap - w);
        hint.style.transform = `translate(${x.toFixed(1)}px, ${((top + bottom) / 2).toFixed(1)}px) translateY(-50%)`;
        hint.style.textAlign = onRight ? "left" : "right";
      }
    }
  });

  return <>
    {pond && <PondWater {...pond} sharedWaves={waves} />}
    <mesh frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial name="volume" transparent depthTest={false} depthWrite={false}
        vertexShader={volumeVertex} fragmentShader={volumeFragment} uniforms={volumeUniforms} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -900]} renderOrder={0}>
      <planeGeometry args={[2000, 2000]} />
      <shaderMaterial name="surface" transparent depthTest={false} depthWrite={false} side={THREE.DoubleSide}
        vertexShader={waterVertex} fragmentShader={waterFragment} uniforms={surfaceUniforms} />
    </mesh>
    <mesh ref={film} renderOrder={2} frustumCulled={false}>
      <planeGeometry args={[1, 1, 64, 48]} />
      <shaderMaterial name="film" transparent depthTest={false} depthWrite={false} side={THREE.DoubleSide}
        vertexShader={filmVertex} fragmentShader={filmFragment} uniforms={filmUniforms} />
    </mesh>
    <points geometry={motes} renderOrder={3} frustumCulled={false}>
      <shaderMaterial name="motes" transparent depthTest={false} depthWrite={false}
        vertexShader={motesVertex} fragmentShader={motesFragment} uniforms={motesUniforms} />
    </points>
    {/* the vessel: the glass's walls refract the frame (FRONT_LAYER, drawn in the second pass),
        the sheet inside is in the frame they refract; the mist stands off the glass at a distance */}
    <group ref={form} visible={false} rotation={[0, OPEN_YAW, 0]}>
      <mesh ref={glassMesh} geometry={artifact.geometry} renderOrder={4} frustumCulled={false} layers={FRONT_LAYER}>
        <shaderMaterial name="glass-back" transparent depthWrite={false} side={THREE.BackSide}
          vertexShader={glassVertex} fragmentShader={surfaceGlassFragment} uniforms={glassU} />
      </mesh>
      <mesh geometry={vessel.sheet.geometry} renderOrder={5} frustumCulled={false}>
        <shaderMaterial name="sheet" transparent depthWrite={false} side={THREE.DoubleSide}
          vertexShader={sheetVertex} fragmentShader={surfaceSheetFragment} uniforms={sheetU} />
      </mesh>
      <mesh geometry={artifact.geometry} renderOrder={6} frustumCulled={false} layers={FRONT_LAYER}>
        <shaderMaterial name="glass-front" transparent depthWrite={false} side={THREE.FrontSide}
          vertexShader={glassVertex} fragmentShader={surfaceGlassFragment} uniforms={glassU} />
      </mesh>
      <group ref={mist} visible={false}>
        <Mist geometry={artifact.geometry} uniforms={glassU} layer={FRONT_LAYER} renderOrder={7} on />
      </group>
    </group>
    <DistanceConstellation stage={stage} anchor={distanceAnchor} depth={distanceDepth} shift={handlingDrop} sceneTexture={refract.target.texture} edgePrint={filmUniforms.uEdgePrint.value} />
    {CLOUD && particleGeometry && (
      <points ref={particles} geometry={particleGeometry} material={particleMaterial} renderOrder={6} frustumCulled={false} />
    )}
  </>;
}

/** Growth eases in and out, so a hand's first and last inch do little. */
const easeMorph = (m: number) => m * m * (3 - 2 * m);

/** Words set against the washed water, which is paper by then: the chrome grey. */
const UNDER_INK = CHROME_GRAY;
/** Signed shift of the handled vessel from the look point, as a fraction of the view. Negative sits higher. */
const HANDLING_DROP = 0.01;

/* The gesture ranges, as ShapeGrowPage reads them. */
const STEP_COPY: Record<Step, { mark: string; name: string; lines: [string, string] }> = {
  shape: {
    mark: "形",
    name: "shape",
    lines: ["each memory already has a shape.", "open your hands, and let these words find theirs."],
  },
  rhythm: {
    mark: "律",
    name: "rhythm",
    lines: ["let its contours find their rhythm.", "spread thumb and index finger for more folds; pinch for fewer."],
  },
  distance: {
    mark: "间",
    name: "distance",
    lines: ["time blurs the edges, not the feeling.", "push your open palm toward the camera to send it farther into the blur."],
  },
  color: {
    mark: "染",
    name: "color",
    lines: ["remembering dyes what happened.", "how does it feel, returning to it today?"],
  },
};

/** Two palms together → sphere; apart → the settled form. */
function distanceToMorph(distance: number): number {
  return clamp01((distance - 0.15) / (0.55 - 0.15));
}
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
function map01(value: number, min: number, max: number): number {
  return clamp01((value - min) / (max - min));
}

const loader = new THREE.TextureLoader();

/* Object URLs belong to the old document and cannot restore an uploaded photo
 * after refresh, so its bytes are kept in the history draft (`readPhoto`,
 * photoSize.ts: a data URL, scaled down from a camera's full size). */

/* The print develops into the strip inside the glass rather than fading in
   flat: the sheet's `uDevelop` runs 0…1.45 and `stripFace` brings the image
   up darks first, as the film's own window developed. By default the picture is
   there from the start and the wrap leaves it; ?print=wrap develops it here. */
function setDevelop(sheet: SheetUniformSet, progress: number) {
  if (PRINT_EARLY) { sheet.uDevelop.value = 1.45; return; }
  sheet.uDevelop.value = Math.min(1, Math.max(0, progress)) * 1.45;
}

/* The wrap's knobs, grouped as the panel shows them. Ranges are generous;
   the defaults above are the current judgement. */
type Knob = TuneKnob<WrapTune>;
const WRAP_KNOBS: { group: string; knobs: Knob[] }[] = [
  { group: "framing", knobs: [
    { key: "cameraY", label: "camera height", min: -5, max: 0, step: 0.05 },
    { key: "cameraZ", label: "camera distance", min: 3, max: 14, step: 0.05 },
    { key: "lookY", label: "look height", min: -4, max: 1.5, step: 0.05 },
    { key: "lookZ", label: "look depth", min: -3, max: 4, step: 0.05 },
    { key: "formY", label: "form height", min: -5, max: -1, step: 0.05 },
    { key: "formZ", label: "form depth (film at 2)", min: -2, max: 4, step: 0.05 },
    { key: "orbitYaw", label: "view turned (°)", min: -180, max: 180, step: 1 },
    { key: "orbitPitch", label: "view raised (°)", min: -80, max: 80, step: 1 },
    { key: "riseSurfaceAt", label: "rise: reaches the surface at (of rise)", min: 0.1, max: 0.9, step: 0.01 },
    { key: "riseBob", label: "rise: comes up past its seat by", min: 0, max: 0.6, step: 0.01 },
    { key: "riseViewUntil", label: "rise: follows the form until (of rise)", min: 0, max: 1, step: 0.01 },
    { key: "riseViewBack", label: "rise: at the pond view by", min: 0.05, max: 1, step: 0.01 },
    { key: "riseAbove", label: "rise: eye lifts by", min: -1, max: 2, step: 0.05 },
    { key: "grow", label: "form grows by", min: 0, max: 1, step: 0.01 },
  ] },
  { group: "timing", knobs: [
    ...(CLOUD ? [
      { key: "releaseS", label: "cloud releases over (on again)", min: 0.3, max: 6, step: 0.1 } as const,
      { key: "fallS", label: "cloud has fallen by", min: 3, max: 16, step: 0.1 } as const,
    ] : []),
  ] },
  { group: "print", knobs: [
    { key: "overlayIn", label: "print develops from", min: 0, max: 10, step: 0.1 },
    { key: "overlayOut", label: "print developed by", min: 0.5, max: 14, step: 0.1 },
  ] },
  // the point cloud's knobs join the panel only when the cloud is on
  ...(CLOUD ? (CLOUD_KNOBS as { group: string; knobs: Knob[] }[]) : []),
];

/** The panel of knobs, down the right; folds to a word. A phase picked on the
    timeline names a group here, which scrolls into view and is marked. */
function WrapTunePanel({ tune, onChange, focus }: { tune: WrapTune; onChange: (next: WrapTune) => void; focus: string | null }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const sections = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    if (!focus) return;
    if (!open) setOpen(true);
    const id = window.requestAnimationFrame(() => sections.current[focus]?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => window.cancelAnimationFrame(id);
  }, [focus, open]);
  const copy = async () => {
    const lines = (Object.keys(WRAP_TUNE_DEFAULT) as (keyof WrapTune)[]).map((k) => `  ${k}: ${Number(tune[k].toFixed(3))},`);
    try {
      await navigator.clipboard.writeText(`{\n${lines.join("\n")}\n}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard refused — the values are still on screen */ }
  };
  return (
    <>
      <TextButton label={open ? "hide knobs" : "knobs"} onClick={() => setOpen((o) => !o)}
        style={{ position: "fixed", right: 28, top: 22, zIndex: 40, fontSize: NOTE_SIZE }} />
      {open && (
        <aside aria-label="wrap knobs" data-covers-right style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 250, padding: "56px 24px 28px 22px",
          boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8, zIndex: 35, overflowY: "auto",
          borderLeft: "1px solid rgba(123, 123, 135, 0.14)", background: "rgba(236, 237, 236, 0.55)", backdropFilter: "blur(6px)" }}>
          {WRAP_KNOBS.filter((g) => g.knobs.length > 0).map(({ group, knobs }) => (
            <section key={group} ref={(el) => { sections.current[group] = el; }}
              style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, scrollMarginTop: 56 }}>
              <p style={{ ...META, margin: "0 0 2px", color: CHROME_GRAY,
                textDecoration: focus === group ? "underline" : "none", textUnderlineOffset: 4 }}>{group}</p>
              {knobs.map(({ key, label, min, max, step }) => (
                <label key={key} style={{ display: "block" }}>
                  <span style={{ display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: NOTE_SIZE, color: CHROME_GRAY }}>
                    <span>{label}</span>
                    <span style={{ opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>{tune[key].toFixed(step < 0.01 ? 3 : 2)}</span>
                  </span>
                  <input type="range" className="wrap-range" min={min} max={max} step={step} value={tune[key]}
                    onChange={(e) => onChange({ ...tune, [key]: Number(e.target.value) })} />
                </label>
              ))}
            </section>
          ))}
          <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
            <TextButton label="reset" onClick={() => onChange(WRAP_TUNE_DEFAULT)} style={{ fontSize: NOTE_SIZE }} />
            <TextButton label={copied ? "copied" : "copy values"} onClick={() => void copy()} style={{ fontSize: NOTE_SIZE }} />
          </div>
          {/* the point cloud is kept aside (wrapCloud.ts); this reloads the lab with it on or off */}
          <TextButton label={CLOUD ? "without the point cloud" : "with the point cloud"} onClick={toggleCloud}
            style={{ fontSize: NOTE_SIZE, marginTop: 6, alignSelf: "flex-start", opacity: 0.7 }} />
        </aside>
      )}
    </>
  );
}

/* The timeline. Seconds since confirm run left to right; each track is one
   thing the shot does, each block the span it does it in, computed from the
   knobs so the blocks move as the sliders do — and the other way: an edge
   dragged writes the knob behind it, a block dragged by its body shifts both
   edges when both are knobs. Pressing a block seeks to its start and names
   its knob group to the panel; pressing or dragging the empty track seeks. */
type WrapBlock = PhaseBlock<WrapTune>;
const KNOB_RANGE = new Map(WRAP_KNOBS.flatMap((g) => g.knobs.map((k) => [k.key, k] as const)));
function clampKnobs(k: WrapTune, next: Partial<WrapTune>): WrapTune {
  const out = { ...k };
  for (const key of Object.keys(next) as (keyof WrapTune)[]) {
    const r = KNOB_RANGE.get(key);
    const v = next[key] as number;
    out[key] = r ? Math.round(Math.min(r.max, Math.max(r.min, v)) / r.step) * r.step : v;
  }
  return out;
}
function phaseBlocks(k: WrapTune): WrapBlock[] {
  const release = WRAP_MOVE_S * 0.5;
  const wrapEnds = wrapEndsFor(k);
  const fallEnd = CLOUD ? (_: WrapTune, s: number) => ({ fallS: s - release }) : undefined;
  const motion: WrapBlock[] = CLOUD ? cloudPhaseBlocks(k, release) : [];
  const riseHeld = wrapEnds + RISE_S * k.riseViewUntil;
  return [
    { track: "camera", label: "draw back · form grows", from: 0, to: WRAP_MOVE_S, group: "framing" },
    ...(CLOUD ? [{ track: "camera", label: "held for the cloud", from: WRAP_MOVE_S, to: wrapEnds, group: "framing", setTo: fallEnd } as WrapBlock] : []),
    { track: "camera", label: "follows the form", from: wrapEnds, to: riseHeld, group: "framing",
      setTo: (_, s) => ({ riseViewUntil: (s - wrapEnds) / RISE_S }) },
    { track: "camera", label: "to the pond view", from: riseHeld, to: wrapEnds + RISE_S * k.riseViewBack, group: "framing",
      setFrom: (_, s) => ({ riseViewUntil: (s - wrapEnds) / RISE_S }), setTo: (_, s) => ({ riseViewBack: (s - wrapEnds) / RISE_S }) },
    ...motion,
    { track: "print", label: "print develops", from: release + k.overlayIn, to: release + Math.max(k.overlayIn + 0.1, k.overlayOut), group: "print",
      setFrom: (_, s) => ({ overlayIn: s - release }), setTo: (_, s) => ({ overlayOut: s - release }) },
    { track: "rise", label: "rises · slows", from: wrapEnds, to: wrapEnds + RISE_S * k.riseSurfaceAt, group: "framing", setFrom: fallEnd,
      setTo: (_, s) => ({ riseSurfaceAt: (s - wrapEnds) / RISE_S }) },
    { track: "rise", label: "surfaces · settles · named", from: wrapEnds + RISE_S * k.riseSurfaceAt, to: wrapEnds + RISE_S, group: "framing",
      setFrom: (_, s) => ({ riseSurfaceAt: (s - wrapEnds) / RISE_S }) },
  ];
}
const TRACKS = ["camera", ...(CLOUD ? CLOUD_TRACKS : []), "print", "rise"];

type Drag =
  | { kind: "seek" }
  | { kind: "edge"; block: WrapBlock; edge: "from" | "to"; x0: number; base: WrapTune }
  | { kind: "body"; block: WrapBlock; x0: number; base: WrapTune; moved: boolean };

const TL_FONT = { fontFamily: SANS, fontSize: 11, fontWeight: 300, letterSpacing: "0.1px", color: CHROME_GRAY } as const;
const TL_LINE = "rgba(85, 85, 95, 0.32)";

function Timeline({ transport, tune, onChange, onFocus }: {
  transport: RefObject<Transport>; tune: WrapTune; onChange: (next: WrapTune) => void; onFocus: (group: string) => void;
}) {
  const [, tick] = useState(0);
  const [open, setOpen] = useState(true);
  const tracksRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 80);
    return () => window.clearInterval(id);
  }, []);
  const tr = transport.current;
  if (!tr.active) return null;
  const blocks = phaseBlocks(tune);
  const tracks = TRACKS.filter((track) => blocks.some((b) => b.track === track));
  const now = blocks.filter((b) => tr.shot >= b.from && tr.shot < b.to).map((b) => b.label);
  const length = tr.length;
  const at = (seconds: number) => `${(Math.min(length, Math.max(0, seconds)) / length * 100).toFixed(2)}%`;
  const seekTo = (seconds: number) => { tr.seek = seconds; tick((n) => n + 1); };
  const secondsAt = (clientX: number) => {
    const r = tracksRef.current?.getBoundingClientRect();
    return r ? (clientX - r.left) / r.width * length : 0;
  };
  const secondsPer = (dx: number) => {
    const r = tracksRef.current?.getBoundingClientRect();
    return r ? dx / r.width * length : 0;
  };
  const begin = (e: ReactPointerEvent, d: Drag) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    drag.current = d;
    try { tracksRef.current?.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer knows; the drag still works while over the tracks */ }
    if (d.kind === "seek") seekTo(secondsAt(e.clientX));
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "seek") { seekTo(secondsAt(e.clientX)); return; }
    const dt = secondsPer(e.clientX - d.x0);
    if (d.kind === "edge") {
      const s = (d.edge === "from" ? d.block.from : d.block.to) + dt;
      const set = d.edge === "from" ? d.block.setFrom : d.block.setTo;
      if (!set) return;
      onChange(clampKnobs(d.base, set(d.base, s)));
      if (tr.paused) seekTo(s);
      return;
    }
    if (Math.abs(e.clientX - d.x0) < 3 && !d.moved) return;
    d.moved = true;
    if (d.block.setFrom && d.block.setTo) {
      const first = clampKnobs(d.base, d.block.setFrom(d.base, d.block.from + dt));
      onChange(clampKnobs(first, d.block.setTo(first, d.block.to + dt)));
      if (tr.paused) seekTo(d.block.from + dt);
    }
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "body" && !d.moved) { seekTo(d.block.from); onFocus(d.block.group); }
  };
  const button = (label: string, title: string, onClick: () => void) => (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      style={{ ...TL_FONT, border: "none", background: "transparent", padding: "2px 5px", cursor: "pointer" }}>{label}</button>
  );
  const ticks = Array.from({ length: Math.floor(length) + 1 }, (_, i) => i);
  const rowH = 22;
  const handle = (block: WrapBlock, edge: "from" | "to") => (
    <span role="presentation" title={edge === "from" ? "drag to move the start" : "drag to move the end"}
      onPointerDown={(e) => begin(e, { kind: "edge", block, edge, x0: e.clientX, base: tune })}
      style={{ position: "absolute", top: -2, bottom: -2, [edge === "from" ? "left" : "right"]: -4, width: 8, cursor: "ew-resize" }} />
  );
  return (
    <div role="group" aria-label="timeline" style={{ ...TL_FONT, position: "fixed", left: 28, right: 290, bottom: 22, zIndex: 36,
      padding: "6px 12px 8px", boxSizing: "border-box", background: "rgba(236, 237, 236, 0.58)", backdropFilter: "blur(6px)",
      borderRadius: 8, border: `1px solid rgba(123, 123, 135, 0.12)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: open ? 8 : 0 }}>
        {button("‹‹", "back one second", () => seekTo(tr.shot - 1))}
        {button("‹", "back a tenth", () => seekTo(tr.shot - 0.1))}
        {button(tr.paused ? "play" : "pause", tr.paused ? "play" : "pause", () => { tr.paused = !tr.paused; tick((n) => n + 1); })}
        {button("›", "forward a tenth", () => seekTo(tr.shot + 0.1))}
        {button("››", "forward one second", () => seekTo(tr.shot + 1))}
        <span style={{ fontVariantNumeric: "tabular-nums", minWidth: "4.2em", marginLeft: 8 }}>{tr.shot.toFixed(2)} s</span>
        <span style={{ flex: 1, opacity: 0.6, marginLeft: 10, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {now.join(" · ")}
        </span>
        <label style={{ ...TL_FONT, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>×{tr.speed.toFixed(2)}</span>
          <input type="range" className="wrap-range" aria-label="speed" min={0.05} max={2} step={0.05} value={tr.speed}
            onChange={(e) => { tr.speed = Number(e.target.value); tick((n) => n + 1); }} style={{ width: 80 }} />
        </label>
        {button(open ? "fold" : "phases", open ? "hide the phases" : "show the phases", () => setOpen((o) => !o))}
      </div>
      {open && <div style={{ display: "grid", gridTemplateColumns: "52px 1fr", columnGap: 12 }}>
        <div>
          {tracks.map((track) => (
            <div key={track} style={{ height: rowH, lineHeight: `${rowH}px`, opacity: 0.6 }}>{track}</div>
          ))}
        </div>
        <div ref={tracksRef} style={{ position: "relative", cursor: "col-resize", touchAction: "none", userSelect: "none" }}
          onPointerDown={(e) => begin(e, { kind: "seek" })}
          onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          {tracks.map((track) => (
            <div key={track} style={{ position: "relative", height: rowH, borderBottom: `1px solid rgba(123, 123, 135, 0.1)` }}>
              {blocks.filter((b) => b.track === track).map((b) => {
                const live = tr.shot >= b.from && tr.shot < b.to;
                const movable = !!(b.setFrom && b.setTo);
                return (
                  <div key={b.label} role="button" tabIndex={0} aria-label={`${b.label}, ${b.from.toFixed(1)} to ${b.to.toFixed(1)} seconds`}
                    title={`${b.label} · ${b.from.toFixed(1)}–${b.to.toFixed(1)} s`}
                    onPointerDown={(e) => begin(e, { kind: "body", block: b, x0: e.clientX, base: tune, moved: false })}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); seekTo(b.from); onFocus(b.group); } }}
                    style={{ position: "absolute", top: 4, bottom: 4, left: at(b.from), width: `calc(${at(b.to)} - ${at(b.from)})`,
                      boxSizing: "border-box", border: `1px solid ${TL_LINE}`, borderRadius: 2, padding: "0 6px", overflow: "visible",
                      whiteSpace: "nowrap", cursor: movable ? "grab" : "pointer", lineHeight: `${rowH - 10}px`,
                      background: live ? "rgba(85, 85, 95, 0.08)" : "transparent", opacity: live ? 1 : 0.72 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{b.label}</span>
                    {b.setFrom && handle(b, "from")}
                    {b.setTo && handle(b, "to")}
                  </div>
                );
              })}
            </div>
          ))}
          {/* the seconds */}
          <div style={{ position: "relative", height: 14 }}>
            {ticks.map((s) => (
              <span key={s} style={{ position: "absolute", left: at(s), transform: "translateX(-50%)", top: 2, opacity: 0.5,
                fontVariantNumeric: "tabular-nums" }}>{s}</span>
            ))}
          </div>
          {/* the playhead */}
          <div aria-hidden style={{ position: "absolute", top: 0, bottom: 14, left: at(tr.shot), width: 1, background: "rgba(85, 85, 95, 0.7)", pointerEvents: "none" }} />
        </div>
      </div>}
    </div>
  );
}

interface PondEntryProps { arrival?: number; active?: boolean; onReady?: () => void; onLeave?: () => void }

function DescentRun({ lab, onAgain, tune, transport, pondEntry }: { lab: boolean; onAgain: () => void; tune: RefObject<WrapTune>; transport: RefObject<Transport>; pondEntry?: PondEntryProps }) {
  const compact = useCompact();
  const navigate = useNavigate();
  const location = useLocation();
  const routeStep = lab ? null : descentStepForPath(location.pathname);
  const [resume] = useState(() => routeStep || location.state?.resumeStep === "color" ? location.state ?? {} : null);
  const from = resume ? "color" : FROM;
  const restoredForm = useMemo(() => resume ? formFromState(resume) : null, [resume]);
  const recording = !lab && location.pathname === RECORD_START_PATH;
  const readingTranscript = !lab && location.pathname === TRANSCRIPT_PATH;
  const invitation = !lab && !recording && !readingTranscript && !isDescentPath(location.pathname);
  const prelude = invitation || recording || readingTranscript;
  const [reducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  // A recording arrives with an id while the words are still being heard.
  // The sample and a direct visit have no id, and use the sample memory.
  const carriedTranscript = typeof location.state?.transcript === "string" ? location.state.transcript.trim() : "";
  const transcriptionId = !lab && typeof location.state?.transcriptionId === "string" ? location.state.transcriptionId : "";
  const [fallbackId] = useState(() => crypto.randomUUID());
  const memoryId = typeof location.state?.memoryId === "string" ? location.state.memoryId : fallbackId;
  const [heard, setHeard] = useState<{ id: string; transcript: string; error: string | null } | null>(null);
  const hearId = useRef(transcriptionId);
  hearId.current = transcriptionId;
  useEffect(() => {
    if (prelude || !transcriptionId || carriedTranscript || heard?.id === transcriptionId) return;
    const pending = getTranscription(transcriptionId);
    if (!pending) {
      setHeard({ id: transcriptionId, transcript: "", error: "The transcription was lost — try recording again." });
      return;
    }
    let alive = true;
    const take = (result: { transcript: string | null; error: string | null }) => {
      if (!alive || hearId.current !== transcriptionId) return;
      const words = result.transcript?.trim() ?? "";
      if (words) {
        setHeard({ id: transcriptionId, transcript: words, error: null });
        void navigate(location.pathname + location.search, {
          replace: true,
          state: { ...location.state, memoryId, transcript: words },
        });
      } else {
        setHeard({ id: transcriptionId, transcript: "", error: result.error ?? "The transcription didn't come through — try recording again." });
      }
    };
    if (pending.result) take(pending.result);
    else void pending.promise.then(take);
    return () => { alive = false; };
  }, [prelude, transcriptionId, carriedTranscript, heard?.id, memoryId, navigate, location.pathname, location.search, location.state]);
  const heardNow = heard?.id === transcriptionId ? heard : null;
  const awaitingTranscript = !!transcriptionId && !carriedTranscript && !heardNow;
  const hearError = heardNow && !heardNow.transcript ? heardNow.error : null;
  const transcript = carriedTranscript || heardNow?.transcript || (transcriptionId ? "" : SAMPLE_TRANSCRIPT);
  const highlightedWords = Array.isArray(location.state?.highlightedWords) ? location.state.highlightedWords.filter((word: unknown) => typeof word === "string") : [];
  const highlightedIndices = Array.isArray(location.state?.highlightedWordIndices) ? location.state.highlightedWordIndices.filter((index: unknown) => typeof index === "number") : [];
  const supplied = useMemo(() =>
    isMemoryAssignment(location.state?.memoryAssignment, transcript) && location.state.memoryAssignment.source !== "fallback"
      ? location.state.memoryAssignment as MemoryAssignment
      : sampleAssignment(transcript) ?? (isMemoryAssignment(location.state?.memoryAssignment, transcript) ? location.state.memoryAssignment as MemoryAssignment : null),
    [location.state?.memoryAssignment, transcript]);
  const [assignment, setAssignment] = useState<MemoryAssignment>(() => isMemoryAssignment(resume?.assignment, transcript) ? resume.assignment : supplied ?? assignMemoryShape(null, memoryId, "fallback", undefined, transcript));
  const [assessmentPending, setAssessmentPending] = useState(!prelude && !supplied && !!transcript.trim());
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const assignmentLocked = useRef(from !== null);
  useEffect(() => {
    if (prelude || awaitingTranscript) { setAssessmentPending(awaitingTranscript && !prelude); return; }
    if (!transcript.trim() || assignmentLocked.current) { setAssessmentPending(false); return; }
    if (supplied) { setAssignment(supplied); setAssessmentPending(false); setAssessmentError(null); return; }
    setAssessmentPending(true);
    setAssessmentError(null);
    setAssignment(assignMemoryShape(null, memoryId, "fallback", undefined, transcript));
    const controller = new AbortController();
    void requestMemoryAssessment(transcript, controller.signal).then(result => {
      if (controller.signal.aborted || assignmentLocked.current) return;
      setAssignment(assignMemoryShape(result.assessment, memoryId, "api", result.model, transcript));
      setAssessmentError(result.error); setAssessmentPending(false);
    });
    return () => controller.abort();
  }, [prelude, awaitingTranscript, transcript, memoryId, supplied]);
  const [editedM2, setEditedM2] = useState<number | null>(null);
  const form = useMemo(() => editedM2 === null ? restoredForm ?? assignment.form : withRhythm(restoredForm ?? assignment.form, editedM2), [restoredForm, assignment.form, editedM2]);
  const m2 = form.side.m;
  const m2Ref = useRef(m2);
  m2Ref.current = m2;
  const stage = useRef<StageState>({
    photoReady: !prelude,
    view: routeStep ? "underwater" : null,
    surfaceLight: 0,
    voicePulses: [],
    foregroundBounds: null,
    request: null, holding: false, step: null,
    morph: resume ? clamp01(resume.shape?.evolve ?? .5) : FROM ? PREVIEW_MORPH : 0, frost: resume ? 1 - clamp01(resume.look?.vividness ?? 1) : FROM ? PREVIEW_FROST : 0,
    oklch: resume?.look?.oklch ?? DEFAULT_OKLCH, hands: [], wrap: false, rise: false, release: false, ascend: false,
  });
  stage.current.photoReady = !prelude;
  const hostRef = useRef<HTMLDivElement>(null);
  const crossingRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLButtonElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shotPhase, setPhase] = useState<Phase>(resume ? "color" : FROM === "wrap" ? "wrapping" : "choose");
  const phase: Phase = routeStep ?? shotPhase;
  const [loading, setLoading] = useState<string | null>(null);
  const [lifted, setLifted] = useState<string | null>(resume?.look?.photoUrl ?? null);
  const [morph, setMorph] = useState(stage.current.morph);
  const [frost, setFrost] = useState(stage.current.frost);
  /** How far along the distance slider: 1 is far & faded (frost at DISTANCE_MAX). */
  const distanceShare = Math.min(1, frost / DISTANCE_MAX);
  const photoLoad = useRef(0);
  const loadedPhotoUrl = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (lab) return;
    const generation = ++photoLoad.current;
    stage.current.request = null;
    setLoading(null);
    if (!routeStep) {
      stage.current.view = "choose";
      loadedPhotoUrl.current = null;
      setLifted(null);
      setPhase("choose");
      assignmentLocked.current = false;
      if (inputRef.current) inputRef.current.value = "";
    } else {
      stage.current.view = "underwater";
      const url = location.state?.look?.photoUrl;
      // Forward from the empty photo step restores the underwater entry's photo.
      if (url !== loadedPhotoUrl.current || !url) {
        setLifted(url ?? null);
        if (!url) stage.current.request = { texture: BLANK_PHOTO, restore: true };
        else void loader.loadAsync(url).then(texture => {
          if (photoLoad.current !== generation) { texture.dispose(); return; }
          loadedPhotoUrl.current = url;
          stage.current.request = { texture, restore: true };
        }).catch(() => {
          if (photoLoad.current === generation) stage.current.request = { texture: BLANK_PHOTO, restore: true };
        });
      }
    }
    return () => { photoLoad.current++; };
    // Only a path change seeks the scene; edits and draft snapshots do not.
  }, [lab, location.pathname]);
  // opening on the wrap, the still is on the film before the stage mounts
  const [ready, setReady] = useState(!lab || from === null);
  useEffect(() => {
    if (!lab || from === null) return;
    let live = true;
    const url = resume ? resume.look?.photoUrl : PREVIEW_PHOTO;
    if (!url) {
      stage.current.request = { texture: BLANK_PHOTO };
      setReady(true);
      return;
    }
    void loader.loadAsync(url).then((texture) => {
      if (!live) return;
      stage.current.request = { texture };
      setLifted(url);
      setReady(true);
    }).catch(() => {
      if (!live) return;
      stage.current.request = { texture: BLANK_PHOTO };
      setReady(true);
    });
    return () => { live = false; };
  }, []);
  const [colorUv, setColorUv] = useState(() => uvFromHomePalette(stage.current.oklch));
  const [colorHeld, setColorHeld] = useState(false);
  const [handsDetected, setHandsDetected] = useState(0);
  const [memoryName, setMemoryName] = useState("");
  const [year, setYear] = useState("");
  const drag = useRef<{ x: number; from: number } | null>(null);

  const step: Step | null = phase === "shape" || phase === "rhythm" || phase === "distance" || phase === "color" ? phase : null;
  const handlingHeadingRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const heading = handlingHeadingRef.current;
    const host = hostRef.current;
    if (step !== "distance" || !heading || !host) {
      stage.current.foregroundBounds = null;
      return;
    }
    let live = true;
    const measure = () => {
      if (!live) return;
      const range = document.createRange();
      range.selectNodeContents(heading);
      const text = range.getBoundingClientRect();
      const scene = host.getBoundingClientRect();
      stage.current.foregroundBounds = {
        left: text.left - scene.left, right: text.right - scene.left,
        top: text.top - scene.top, bottom: text.bottom - scene.top,
      };
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(heading); observer.observe(host);
    window.addEventListener("resize", measure);
    void document.fonts.ready.then(measure);
    return () => { live = false; observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [step]);
  const [cameraChoice, setCameraChoice] = useState<"ask" | "starting" | "enabled" | "manual">(CAMERA_ENABLED ? "ask" : "manual");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const cameraDialogOpen = step !== null && (cameraChoice === "ask" || cameraChoice === "starting");
  stage.current.step = step;
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    if (step !== "rhythm") return;
    // The first step can be skipped with growth still at zero. Ease out of
    // that sphere through the existing pose animation so m2 has visible folds.
    const next = rhythmMorph(stage.current.morph);
    stage.current.morph = next;
    setMorph(next);
  }, [step]);

  useEffect(() => {
    if (phase === "naming") nameRef.current?.focus();
  }, [phase]);

  const setSignal = (value: number) => {
    const v = clamp01(value);
    if (stepRef.current === "shape") { stage.current.morph = v; setMorph(v); }
    else if (stepRef.current === "rhythm") setEditedM2(rhythmValue(v * RHYTHM_MAX));
    else if (stepRef.current === "distance") {
      // the gestures and the slider give a share of the way; the haze stops at DISTANCE_MAX
      const frost = v * DISTANCE_MAX;
      stage.current.frost = frost;
      setFrost(frost);
    }
  };
  const colorUvRef = useRef(colorUv);
  const pickColor = (u: number, v: number) => {
    const uv = { u: clamp01(u), v: clamp01(v) };
    colorUvRef.current = uv;
    setColorUv(uv);
    stage.current.oklch = sampleHomePalette(uv.u, uv.v);
  };
  const colorHeldRef = useRef(false);
  const pinchFrames = useRef(0);
  /** Who last put hands in the water: the camera wins while it sees any. */
  const handsFrom = useRef<"camera" | "pointer" | null>(null);
  const morphGate = useRef(createGestureGate(0.015));
  const distancePush = useRef(createDistancePush());
  const rhythmPinch = useRef(createRhythmPinch());
  useEffect(() => {
    // fresh baselines each step, so a hand already in frame does not jump the form
    morphGate.current = createGestureGate(0.015);
    distancePush.current.reset();
    rhythmPinch.current.reset();
    colorHeldRef.current = false;
    pinchFrames.current = 0;
    setColorHeld(false);
    stage.current.hands = [];
    handsFrom.current = null;
  }, [step]);

  /* Two palms apart for shape, a thumb–index pinch for rhythm, one palm pushing for
     distance, a fingertip over the field for color (pinch to hold).
     After the form surfaces, the camera starts only through the access dialog;
     dragging stays available when it is refused or no hand is seen. */
  // The tracker's files download from the hold onward, while the form rises;
  // the tracker itself is built while the camera dialog is open.
  const handsSoon = CAMERA_ENABLED && (phase === "descending" || step !== null);
  useEffect(() => {
    if (handsSoon) preloadHandTracking();
  }, [handsSoon]);
  const tracking = useHandTracking({
    enabled: CAMERA_ENABLED && step !== null && (cameraChoice === "starting" || cameraChoice === "enabled"),
    prepare: CAMERA_ENABLED && step !== null && cameraChoice !== "manual",
    videoRef,
    numHands: step === "shape" ? 2 : 1,
    onLandmarks: (hands) => {
      if (cameraChoice !== "enabled") return;
      setHandsDetected(hands.length);
      // the camera is mirrored, as the corner window shows it; landmark y runs down
      handsFrom.current = "camera";
      stage.current.hands = hands.map((hand) => {
        const c = handCenter(hand);
        return { x: 1 - c.x, y: 1 - c.y };
      });
      const tab = stepRef.current;
      if (tab === "shape") {
        if (hands.length < 2) return;
        const distance = landmarkDistance(handCenter(hands[0]), handCenter(hands[1]));
        if (morphGate.current.update(distance)) setSignal(distanceToMorph(distance));
      } else if (tab === "rhythm") {
        const hand = hands[0];
        if (!hand) { rhythmPinch.current.reset(); return; }
        const video = videoRef.current;
        const next = rhythmPinch.current.update(hand,
          video?.videoHeight ? video.videoWidth / video.videoHeight : 1,
          performance.now(), m2Ref.current);
        if (next !== null) { m2Ref.current = next; setEditedM2(next); }
      } else if (tab === "distance") {
        const video = videoRef.current;
        const next = distancePush.current.update(hands[0],
          video?.videoHeight ? video.videoWidth / video.videoHeight : 1,
          performance.now(), stage.current.frost / DISTANCE_MAX);
        if (next !== null) setSignal(next);
      } else if (tab === "color") {
        const hand = hands[0];
        const pinch = landmarkDistance(hand[4], hand[8], true);
        if (pinch < 0.052) {
          pinchFrames.current += 1;
          if (!colorHeldRef.current && pinchFrames.current >= 2) { colorHeldRef.current = true; setColorHeld(true); }
        } else {
          pinchFrames.current = 0;
          if (colorHeldRef.current && pinch > 0.08) { colorHeldRef.current = false; setColorHeld(false); }
        }
        if (colorHeldRef.current) return;
        const nextU = 1 - map01(hand[8].x, 0.12, 0.88);
        const nextV = map01(hand[8].y, 0.16, 0.84);
        const current = colorUvRef.current;
        pickColor(current.u + (nextU - current.u) * 0.24, current.v + (nextV - current.v) * 0.24);
      }
    },
    onNoHands: () => {
      rhythmPinch.current.reset();
      distancePush.current.reset();
      setHandsDetected(0);
      if (handsFrom.current === "camera") { handsFrom.current = null; stage.current.hands = []; }
      if (colorHeldRef.current) { colorHeldRef.current = false; pinchFrames.current = 0; setColorHeld(false); }
    },
  });
  useEffect(() => {
    if (tracking.isTracking) setCameraChoice("enabled");
  }, [tracking.isTracking]);
  useEffect(() => {
    if (!tracking.error) return;
    setCameraError(tracking.error);
    setCameraChoice("ask");
  }, [tracking.error]);
  const handsNeeded = step === "shape" ? 2 : 1;
  const gestureLive = tracking.isTracking && handsDetected >= handsNeeded;

  const [leaving, setLeaving] = useState(false);
  const exitRaf = useRef(0);
  const exitStarted = useRef(false);
  const navigatingStep = useRef(false);
  useEffect(() => () => {
    cancelAnimationFrame(exitRaf.current);
    stage.current.captureSurface = undefined;
  }, []);
  useEffect(() => {
    // Browser Back can interrupt the dissolve before it hands off to naming.
    cancelAnimationFrame(exitRaf.current);
    stage.current.captureSurface = undefined;
    stage.current.surfaceLight = 0;
    stage.current.release = false;
    stage.current.ascend = false;
    exitStarted.current = false;
    setLeaving(false);
  }, [location.pathname]);

  const draftState = () => ({
    ...location.state,
    memoryId, transcript, highlightedWords, highlightedWordIndices: highlightedIndices,
    assignment, memoryAssignment: assignment, form,
    morphProgress: stage.current.morph,
    look: { ...(lifted ? { photoUrl: lifted } : {}), oklch: stage.current.oklch, vividness: 1 - stage.current.frost },
    shape: { form, fluidity: 0, evolve: stage.current.morph, bumpAmount: 0 },
  });
  const refreshDraft = useRef({ routeStep, draftState });
  refreshDraft.current = { routeStep, draftState };
  useEffect(() => {
    const keepDraft = () => {
      if (!refreshDraft.current.routeStep) return;
      // Preserve the router's entry key/index. No route update or canvas remount
      // is needed; a reload reads this entry's latest photo and handling edits.
      window.history.replaceState({
        ...window.history.state, usr: refreshDraft.current.draftState(),
      }, "");
    };
    window.addEventListener("beforeunload", keepDraft);
    window.addEventListener("pagehide", keepDraft);
    return () => {
      window.removeEventListener("beforeunload", keepDraft);
      window.removeEventListener("pagehide", keepDraft);
    };
  }, []);
  const rememberDraft = async () => {
    const state = draftState();
    // Update this entry before pushing the next one, so returning from naming
    // (which has a separate host) restores the final edits, including colour.
    await navigate(location.pathname + location.search, { replace: true, state });
    return state;
  };
  const goStep = async (next: Step | null) => {
    if (lab) {
      if (next === null) stage.current.view = "surface";
      setPhase(next ?? (lifted ? "floating" : "choose"));
      return;
    }
    if (navigatingStep.current) return;
    navigatingStep.current = true;
    try {
      const state = await rememberDraft();
      await navigate((next === null ? DESCENT_ROUTE : DESCENT_STEP_PATHS[next]) + location.search, { state });
    } finally {
      navigatingStep.current = false;
    }
  };
  const backStep = () => {
    if (!step || navigatingStep.current) return;
    // Back also cancels the light-to-naming handoff before it can navigate.
    cancelAnimationFrame(exitRaf.current);
    stage.current.captureSurface = undefined;
    stage.current.surfaceLight = 0;
    exitStarted.current = false;
    setLeaving(false);
    const previous: Record<Step, Step | null> = {
      shape: null, rhythm: "shape", distance: "rhythm", color: "distance",
    };
    void goStep(previous[step]);
  };
  const continueStep = async () => {
    if (exitStarted.current) return;
    if (phase === "shape") await goStep("rhythm");
    else if (phase === "rhythm") await goStep("distance");
    else if (phase === "distance") await goStep("color");
    else if (phase === "color") {
      exitStarted.current = true;
      if (!lab) await rememberDraft();
      // The handling is over. The eye and the form stay where they are; the
      // step's chrome goes, and the water takes its colour back around the
      // form — the wash and the dye let go, and the glass reflects water again.
      // In the same movement eye and form float up: the surface comes in over
      // the top of the frame, the light takes the frame, and naming follows.
      setLeaving(true);
      stage.current.release = true;
      stage.current.ascend = true;
    }
  };
  const namingState = () => {
    const oklch = stage.current.oklch;
    const matPresetIndex = Math.min(
      Math.round((((oklch.h % 360) + 360) % 360) / 360 * (MATERIAL_PRESETS.length - 1)),
      MATERIAL_PRESETS.length - 1,
    );
    return {
      memoryId, transcript, highlightedWords, assignment, form,
      morphProgress: stage.current.morph,
      oklch,
      matColor: meshCoreFromOklch(oklch),
      matPresetIndex,
      rise: true,
      look: { ...(lifted ? { photoUrl: lifted } : {}), oklch, vividness: 1 - stage.current.frost },
      shape: { form, fluidity: 0, evolve: stage.current.morph, bumpAmount: 0 },
    };
  };
  const ascended = () => {
    if (lab) { setPhase("naming"); return; }
    navigate(NAMING_PATH, { state: namingState() });
  };
  const currentYear = new Date().getFullYear();
  const yearSettled = year.length === 4 && Number(year) <= currentYear;
  const canSave = phase === "naming" && memoryName.trim() !== "" && yearSettled;
  const savedThisRun = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* The lab's save path keeps the same complete artifact as the naming rim. */
  const save = () => {
    if (!canSave || savedThisRun.current) return;
    const oklch = stage.current.oklch;
    const matPresetIndex = Math.min(
      Math.round((((oklch.h % 360) + 360) % 360) / 360 * (MATERIAL_PRESETS.length - 1)),
      MATERIAL_PRESETS.length - 1,
    );
    const stored = saveMemory({
      id: memoryId,
      title: memoryName.trim(),
      year,
      transcript,
      highlightedWords,
      assignment,
      shape: { form, matPresetIndex, fluidity: 0, evolve: stage.current.morph, bumpAmount: 0 },
      colorIndex: draftColorIndex(matPresetIndex),
      look: { ...(lifted ? { photoUrl: lifted } : {}), oklch, vividness: 1 - stage.current.frost },
      createdAt: new Date().toISOString(),
    });
    if (!stored) {
      setSaveError("Your browser couldn’t save this memory for the session. Storage may be full or disabled.");
      return;
    }
    savedThisRun.current = true;
    setSaveError(null);
    setPhase("saved");
  };

  const pick = async (photo: string | File) => {
    if (phase !== "choose" || loading) return;
    const generation = ++photoLoad.current;
    setLoading(typeof photo === "string" ? photo : photo.name);
    try {
      const url = typeof photo === "string" ? photo : await readPhoto(photo);
      if (photoLoad.current !== generation) return;
      const texture = await loader.loadAsync(url);
      if (photoLoad.current !== generation) { texture.dispose(); return; }
      loadedPhotoUrl.current = url;
      stage.current.request = { texture };
      setLifted(url);
    } catch {
      if (photoLoad.current === generation) setLoading(null);
    }
  };

  const setHolding = (holding: boolean) => {
    // Do not freeze the placeholder while the words or their reading are still arriving.
    if (holding && (assessmentPending || awaitingTranscript || !!hearError)) return;
    // Resolve once before descent. A late API result must never replace a handled form.
    if (holding) { assignmentLocked.current = true; setAssessmentPending(false); }
    stage.current.holding = holding;
  };
  const choosing = phase === "choose" && !lifted && !loading;
  // Opacity alone is insufficient: the photo entrance keyframes can override
  // it on a history return. Keep all surface controls out of layout underwater.
  const surfaceControlsVisible = !prelude && !routeStep &&
    (phase === "choose" || phase === "falling" || phase === "floating");

  /* While the camera sees no hand, the pointer is the hand in the water. */
  const pointerAsHand = (e: ReactPointerEvent) => {
    if (!step || handsFrom.current === "camera") return;
    const host = hostRef.current?.getBoundingClientRect();
    if (!host) return;
    handsFrom.current = "pointer";
    stage.current.hands = [{ x: (e.clientX - host.left) / host.width, y: 1 - (e.clientY - host.top) / host.height }];
  };
  const pointerOut = () => {
    if (handsFrom.current === "pointer") { handsFrom.current = null; stage.current.hands = []; }
  };

  return (
    <main ref={hostRef} style={{ position: "relative", width: "100%", height: "100dvh", overflow: "clip",
      pointerEvents: leaving ? "none" : undefined,
      background: resume ? SINK_WASH : "linear-gradient(#ededE8, #e2e6e2 42%, #b6c8c3)" }}
      onPointerMove={pointerAsHand}
      onPointerLeave={pointerOut}>
      <MemoryPondPage {...pondEntry} active={invitation && (pondEntry?.active ?? true)}
        reducedMotion={reducedMotion} covered={!invitation}
        renderScene={pond => ready ? (<Canvas camera={{ fov: 48, near: 0.1, far: 2400, position: POND_CAMERA.toArray() }}
        onCreated={({ gl, scene }) => { gl.domElement.dataset.pondScene = scene.uuid; }}
        dpr={[1, MAX_DPR]} gl={{ antialias: true, alpha: true }} style={{ position: "absolute", inset: 0 }}>
        <PortraitFit />
        <Stage pond={pond} stage={stage} form={form} from={from} tune={tune} transport={transport} crossingRef={crossingRef} glowRef={glowRef} pickRef={pickRef} captionRef={captionRef} hintRef={hintRef}
          onFallStart={() => setPhase("falling")}
          onSettled={() => setPhase("floating")}
          onDescend={() => setPhase("descending")}
          onUnder={() => { void goStep("shape"); }}
          onWrapped={() => { stage.current.rise = true; setPhase("rising"); }}
          onRisen={() => setPhase("naming")}
          onAscended={ascended}
          onRewound={(to) => setPhase(to)} />
      </Canvas>) : null} />
      <div ref={glowRef} aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 48% 24%, #fff9, transparent 58%)" }} />
      <div ref={crossingRef} aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0,
        background: "rgba(232, 238, 236, 0.35)" }} />
      {/* The light that takes the frame as the eye nears the surface: frame and glass whiten and blur. */}

      {!invitation && <PageHeader layout="absolute" carousel={lab ? false : undefined} />}
      <HandTrackingDialog open={cameraDialogOpen} busy={cameraChoice === "starting"}
        error={cameraError}
        onAllow={() => { setCameraError(null); setCameraChoice("starting"); }}
        onManual={() => setCameraChoice("manual")} />
      {recording && <>
        <BackButton onClick={() => navigate(MEMORY_POND_PATH, { state: location.state })} />
        <PondRecordingOverlay reducedMotion={reducedMotion}
          onVoicePulse={pulse => { stage.current.voicePulses.push(pulse); }} />
      </>}
      {readingTranscript && <>
        <BackButton onClick={() => navigate(RECORD_START_PATH + location.search, { state: location.state })} />
        <PuddleTranscriptPage reducedMotion={reducedMotion}
          onTranscribingPulse={pulse => { stage.current.voicePulses.push(pulse); }} />
      </>}
      {!prelude && <>
      {lab && <p style={{ ...META, position: "absolute", top: 26, left: step ? 76 : 28, margin: 0, zIndex: 20 }}>lab — descent</p>}
      {step && <BackButton onClick={backStep} />}
      {!lab && (phase === "choose" || phase === "floating") && (
        <BackButton onClick={() => navigate(TRANSCRIPT_PATH + location.search, {
          state: {
            ...draftState(),
            transcript,
            memoryId,
            transcriptReady: true,
            ...(!assessmentPending && transcript ? { memoryAssignment: assignment } : {}),
            ...(location.state?.focus ? { focus: location.state.focus } : {}),
          },
        })} />
      )}
      {(phase === "choose" || phase === "floating") && (lab || hearError || (assessmentPending && phase !== "choose") || assessmentError) && <div style={{ ...META, position: "absolute", top: lab ? 52 : 72, left: 28, zIndex: 20, maxWidth: 280 }}>
        {lab && <Link to="/lab/meaning" state={{ transcript }} style={{ color: "inherit" }}>{transcript ? "read this memory again" : "begin with a recorded memory"}</Link>}
        {hearError && <p role="alert">{`couldn't hear that — ${hearError.toLowerCase()}`}</p>}
        {hearError && <TextButton label="record again" onClick={() => navigate(RECORD_START_PATH, { state: location.state?.shape ? { shape: location.state.shape, ...(location.state.focus ? { focus: location.state.focus } : {}) } : location.state })} />}
        {assessmentPending && phase !== "choose" && <p role="status">finding the form of this memory… you can descend when it is ready.</p>}
        {assessmentError && <p>{assessmentError}</p>}
      </div>}

      {/* The camera, a small mirrored window in the corner while the hands steer,
          seen through a slow shutter (ShutterCamera). The video itself is only
          for the hand tracker. */}
      <video ref={videoRef} playsInline muted aria-hidden
        style={{ position: "absolute", right: 28, bottom: 28, width: 128, height: 96, opacity: 0, pointerEvents: "none" }} />
      <ShutterCamera video={videoRef} active={!!step && tracking.isTracking}
        style={{ position: "absolute", right: 28, bottom: 28, width: 128, height: 96,
          borderRadius: 10, transform: "scaleX(-1)", zIndex: 20, pointerEvents: "none",
          opacity: step && tracking.isTracking && !leaving ? 1 : 0, transition: "opacity 700ms ease" }} />

      <div data-descent-photo-controls hidden={!surfaceControlsVisible}
        style={{ display: surfaceControlsVisible ? "contents" : "none" }}>
      <FlowPageGrid heading={
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: INSTRUCTION_SIZE, lineHeight: 1.45, color: UNDER_INK }}>
          click the film frame to upload a photo for this memory
        </p>
      } headingStyle={{ opacity: choosing ? 1 : 0, transition: "opacity 700ms ease",
        animation: choosing && !from ? "descentFadeIn 1400ms ease 900ms backwards" : "none" }} />

      {/* The strip itself is the picker: an unseen button kept over it by the stage. */}
      <button ref={pickRef} type="button" aria-label="choose a photo for the film"
        onClick={() => inputRef.current?.click()} disabled={!choosing}
        style={{ position: "absolute", top: 0, left: 0, border: "none", padding: 0, background: "transparent",
          cursor: choosing ? "pointer" : "default", zIndex: 10, pointerEvents: choosing ? "auto" : "none" }} />
      <input ref={inputRef} type="file" accept="image/*" aria-label="choose a photo" style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }} />

      {/* The bundled stills, small and to one side, so the lab can run without a photo of one's own. */}
      <div role="listbox" aria-label="photo library" style={{ position: "absolute", left: 0, right: 0, bottom: 34,
        display: "flex", justifyContent: "center", alignItems: "center", gap: 14,
        opacity: choosing ? 1 : 0, transition: "opacity 500ms ease 150ms", animation: choosing && !from ? "descentFadeIn 1400ms ease 1500ms backwards" : "none",
        pointerEvents: choosing ? "auto" : "none", zIndex: 10 }}>
        <span style={{ fontFamily: SANS, fontSize: NOTE_SIZE, color: CHROME_GRAY, opacity: 0.6, marginRight: 6 }}>or one of these</span>
        {PHOTOS.map((url) => (
          <button key={url} type="button" role="option" aria-selected={lifted === url} aria-label="select photo"
            onClick={() => void pick(url)}
            style={{ width: 48, height: 48, flex: "0 0 48px", padding: 0, overflow: "hidden",
              borderRadius: "50%", border: "1px solid rgba(123, 123, 135, 0.25)", background: "#e7e7e8",
              boxShadow: "0 6px 18px rgba(40, 36, 48, 0.1)", cursor: "pointer", opacity: 0.85 }}>
            <img src={url} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        ))}
      </div>

      {phase === "floating" && (
        <button type="button" aria-label="press to pass through" aria-describedby="descent-hint"
          disabled={assessmentPending}
          onPointerDown={(e) => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); setHolding(true); }}
          onPointerUp={() => setHolding(false)}
          onPointerCancel={() => setHolding(false)}
          onLostPointerCapture={() => setHolding(false)}
          onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); setHolding(true); } }}
          onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setHolding(false); } }}
          onContextMenu={(e) => e.preventDefault()}
          autoFocus
          style={{ position: "absolute", inset: 0, border: "none", outline: "none", background: "transparent",
            touchAction: "none", cursor: "default", zIndex: 5 }} />
      )}
      {/* beside the floating photo: the stage keeps it there (hintRef) */}
      <p ref={hintRef} id="descent-hint" aria-hidden style={{
        position: "absolute", left: 0, top: 0, margin: 0,
        width: "max-content", maxWidth: "min(20em, 40vw)", pointerEvents: "none", zIndex: 6,
        color: CHROME_GRAY, fontFamily: SERIF, fontWeight: 400, fontSynthesis: "none",
        fontSize: INSTRUCTION_SIZE, lineHeight: 1.45,
        opacity: phase === "floating" ? 1 : 0, filter: phase === "floating" ? "none" : "blur(6px)",
        transition: "opacity 720ms ease, filter 720ms ease" }}>
        {assessmentPending ? "finding your memory’s form…" : "press to pass through"}
      </p>
      </div>

      {/* ── the four steps, under the water ── */}
      {step && step !== "color" && (
        <div role="slider" tabIndex={0} aria-label={`${step} — drag across`} aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round((step === "shape" ? morph : step === "rhythm" ? m2 / RHYTHM_MAX : distanceShare) * 100)}
          aria-valuetext={step === "distance" ? `${Math.round(distanceShare * 100)}% distant` : undefined}
          onKeyDown={(e) => {
            const value = step === "shape" ? morph : step === "rhythm" ? m2 / RHYTHM_MAX : distanceShare;
            const next = e.key === "Home" ? 0 : e.key === "End" ? 1
              : e.key === "ArrowRight" || e.key === "ArrowUp" ? value + 0.05
              : e.key === "ArrowLeft" || e.key === "ArrowDown" ? value - 0.05 : null;
            if (next !== null) { e.preventDefault(); setSignal(next); }
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events have no pointer to capture */ }
            drag.current = { x: e.clientX, from: step === "shape" ? morph : step === "rhythm" ? m2 / RHYTHM_MAX : distanceShare };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setSignal(drag.current.from + (e.clientX - drag.current.x) / (window.innerWidth * 0.45));
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          style={{ position: "absolute", inset: 0, zIndex: 5, touchAction: "none", cursor: "ew-resize" }} />
      )}
      {step && step !== "color" && (
        <div style={{ position: "absolute", bottom: 124, left: "50%", transform: "translateX(-50%)", zIndex: 10,
          opacity: leaving ? 0 : 1, transition: "opacity 700ms ease" }}>
          {step === "shape" && <SpectrumSlider value={morph} onChange={setSignal} from="circle" to="flower"
            label="memory shape" valueText={`${Math.round(morph * 100)}% shaped`} />}
          {step === "rhythm" && <SpectrumSlider value={m2 / RHYTHM_MAX} onChange={setSignal} from="petals" to="bloom"
            label="shape rhythm" valueText={`${Math.round(m2 * 4) / 4} folds`} keyStep={1 / RHYTHM_MAX} />}
          {step === "distance" && <SpectrumSlider value={distanceShare} onChange={setSignal} from="circle" to="haze"
            label="memory distance" valueText={`${Math.round(distanceShare * 100)}% distant`} />}
        </div>
      )}
      {step === "color" && (
        <div style={{ opacity: leaving ? 0 : 1, transition: "opacity 1400ms ease" }}>
          {/* a pale veil under the wash, so the band reads as light on the paper rather than a strip */}
          <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "30vh", zIndex: 9, pointerEvents: "none",
            background: "linear-gradient(to bottom, rgba(236,237,238,0) 0%, rgba(236,237,238,.55) 45%, rgba(236,237,238,.7) 100%)" }} />
          <OklchColorField opacity={0.85} sample={sampleHomePalette} u={colorUv.u} v={colorUv.v} held={colorHeld} onPick={({ u, v }) => pickColor(u, v)} />
        </div>
      )}
      {step && <>
        <FlowPageGrid headingRef={handlingHeadingRef} style={{ opacity: leaving ? 0 : 1, transition: "opacity 700ms ease" }}
          headingTop={compact ? UNDERWATER_PHONE.headingTop : undefined}
          headingStyle={{ marginTop: compact ? 0 : -28 }}
          heading={<div key={step} style={{ animation: "descentStepIn 900ms ease backwards" }}>
            <p style={{ ...TITLE, margin: 0, color: UNDER_INK, fontFamily: SERIF_CJK, lineHeight: 1 }}>{STEP_COPY[step].mark}</p>
            <p style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: PAGE_HEADER_MARK.fontSize, lineHeight: 1.45, color: UNDER_INK }}>
              {STEP_COPY[step].name}
            </p>
            <p style={{ margin: `${compact ? UNDERWATER_PHONE.instructionGap : 28}px 0 0`, fontFamily: SERIF, fontSize: compact ? UNDERWATER_PHONE.instructionSize : PAGE_HEADER_MARK.fontSize + 2, lineHeight: 1.45, color: UNDER_INK }}>
              {STEP_COPY[step].lines[0]}<br />{STEP_COPY[step].lines[1]}
            </p>
          </div>}
          actions={<PillButton label="continue" trailing="›" onClick={continueStep} />}
          actionsStyle={{ pointerEvents: leaving ? "none" : "auto" }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 21, pointerEvents: "none",
          opacity: (step === "distance" || tracking.isTracking) && !leaving ? 0.8 : 0, transition: "opacity 900ms ease" }}>
          <GestureHint kind={step} active={gestureLive} style={{
            top: "auto", left: "auto", right: 28 + 64, bottom: 28 + 96 + 12, transform: "translateX(50%)",
            // Keep the fist/open-palm reference available while adjusting distance,
            // including when the camera is off or a hand is already in frame.
            ...(step === "distance" ? { opacity: gestureLive ? 0.5 : 0.92 } : {}),
          }} />
        </div>
      </>}

      {/* ── the caption: typed while the memory floats, then left as words ── */}
      <div ref={captionRef} style={{ position: "absolute", top: 0, left: 0, zIndex: 8, display: "flex", flexDirection: "column",
        alignItems: "center", opacity: phase === "naming" || phase === "saved" ? 1 : 0, transition: "opacity 900ms ease",
        pointerEvents: phase === "naming" ? "auto" : "none" }}>
        <div style={{ marginBottom: CAPTION_TITLE_GAP }}>
          {phase === "saved" ? <p style={CAPTION_TITLE_STYLE}>{memoryName}</p> : (
            <input ref={nameRef} value={memoryName} onChange={(e) => setMemoryName(e.target.value)} placeholder="name this memory..."
              aria-label="memory name" className="descent-field" style={{ ...CAPTION_TITLE_STYLE, width: "16em" }} />
          )}
        </div>
        {phase === "saved" ? <p style={CAPTION_YEAR_STYLE}>{year}</p> : (
          <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="year"
            inputMode="numeric" maxLength={4} aria-label="year" className="descent-field"
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            style={{ ...CAPTION_YEAR_STYLE, width: "6em" }} />
        )}
        {saveError && <p role="alert" style={{ ...CAPTION_YEAR_STYLE, maxWidth: 300 }}>{saveError}</p>}
        <TextButton label="save memory" onClick={save} disabled={!canSave}
          style={{ position: "absolute", top: "100%", marginTop: 48, opacity: canSave ? 1 : 0, transition: "opacity 400ms ease" }} />
      </div>
      {/* once kept, the gallery opens on it — the way the naming rim hands over */}
      {phase === "saved" && (
        <TextButton label="see it among the others"
          onClick={() => navigate(CAROUSEL_PATH, { replace: true, state: { galleryOpen: true, galleryFocusId: memoryId, galleryCarried: true } })}
          style={{ position: "absolute", left: "50%", bottom: 40, transform: "translateX(-50%)", zIndex: 20,
            animation: "descentFadeIn 900ms ease 600ms backwards" }} />
      )}

      <style>{`
        @keyframes descentFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes descentStepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .descent-field { background: transparent; border: none; outline: none; padding: 0; }
        .descent-field::placeholder { color: inherit; opacity: .35; font-style: inherit; }
      `}</style>

      {lab && phase !== "choose" && (
        <TextButton label="again" onClick={() => {
          // Replay the exact assignment; a second save is a new memory, not a duplicate id.
          navigate(location.pathname + location.search, { replace: true, state: { ...location.state, transcript, memoryId: crypto.randomUUID(), memoryAssignment: assignment } });
          onAgain();
        }}
          style={{ position: "absolute", left: 28, bottom: 28, zIndex: 20, color: phase === "descending" ? "#e8eeec" : "#7b7b87",
            transition: "color 600ms ease" }} />
      )}
      </>}
    </main>
  );
}

function DescentShell({ lab, pondEntry }: { lab: boolean; pondEntry?: PondEntryProps }) {
  const [run, setRun] = useState(0);
  // the knobs outlive a run, so "again" replays with the sliders where they were
  const [tune, setTune] = useState<WrapTune>(WRAP_TUNE_DEFAULT);
  const tuneRef = useRef(tune);
  tuneRef.current = tune;
  // the transport too: a paused lab stays paused through "again", at the wrap's first frame
  const transport = useRef<Transport>({ paused: false, speed: SPEED, seek: null, shot: 0, length: 1, active: false });
  // the knob group the timeline last pointed at
  const [focus, setFocus] = useState<string | null>(null);
  return (
    <>
      <DescentRun key={run} lab={lab} pondEntry={pondEntry} onAgain={() => { transport.current.active = false; setRun((r) => r + 1); }} tune={tuneRef} transport={transport} />
      {lab && <>
        <WrapTunePanel tune={tune} onChange={setTune} focus={focus} />
        <Timeline transport={transport} tune={tune} onChange={setTune} onFocus={setFocus} />
        <style>{`
          .wrap-range { -webkit-appearance: none; appearance: none; width: 100%; height: 16px; margin: 0; background: transparent; cursor: pointer; display: block; }
          .wrap-range::-webkit-slider-runnable-track { height: 1px; background: rgba(123, 123, 135, 0.4); }
          .wrap-range::-moz-range-track { height: 1px; background: rgba(123, 123, 135, 0.4); }
          .wrap-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 9px; height: 9px; border-radius: 50%; margin-top: -4px; background: #7b7b87; border: none; }
          .wrap-range::-moz-range-thumb { width: 9px; height: 9px; border-radius: 50%; background: #7b7b87; border: none; }
          .wrap-range:focus-visible { outline: none; }
          .wrap-range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 3px rgba(123, 123, 135, 0.25); }
        `}</style>
      </>}
    </>
  );
}

/** /lab/descent — the shot, with its knobs. */
export function DescentPrototype() {
  return <DescentShell lab />;
}

/** Shared scene from the pond invitation through recording and descent. */
export function DescentFlow(props: PondEntryProps) {
  return <DescentShell lab={false} pondEntry={props} />;
}
