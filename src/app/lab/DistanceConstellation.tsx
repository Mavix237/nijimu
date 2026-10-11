import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { buildArchive } from "../lib/archive";
import { galleryStateFor } from "./VesselGalleryPreview";
import { FIELD_FOCAL, distancePreviewSeat, memoryFieldPlace, type FieldTextBounds } from "./vesselField";
import { loadSeatPhoto } from "./VesselArtifact";
import { viewHalfTan } from "../lib/portraitView";
import { useVesselParts, type VesselParts } from "./vesselBuilds";
import {
  BLANK_PHOTO, FRONT_LAYER,
  createGlassUniformSet, createSheetUniformSet, glassVertex, glassRefractFragment,
  sheetVertex, sheetFragment, keyFrom, seedDirections, writeGlassUniforms, writeSheetUniforms,
  type VesselState,
} from "./VesselPreview";

interface Context {
  stage: RefObject<{ step: string | null; foregroundBounds: FieldTextBounds | null }>;
  anchor: RefObject<THREE.Vector3>;
  depth: RefObject<number>;
  /** Signed shift of the handled vessel from the view centre, as a fraction of the height. Negative sits higher. */
  shift: RefObject<number | null>;
  sceneTexture: THREE.Texture;
  edgePrint: THREE.Texture;
}

/** The gallery's real glass, draped photos and edited forms, in the shot's one
 * WebGL context. All neighbours share its refraction target and camera. */
export function DistanceConstellation(props: Context) {
  const { size } = useThree();
  const phone = size.width <= 600 && size.width < size.height;
  const memories = useMemo(() => {
    const all = buildArchive().map((item, index) => ({
      id: item.id, index, state: galleryStateFor(item), place: memoryFieldPlace(index, item.look?.vividness),
    }));
    if (!phone) return all;
    // An upright phone holds fewer: in order, each kept only if it starts clear
    // of those already kept, up to PHONE_NEIGHBOURS — the field stays legible
    // round the form instead of crowding a narrow screen.
    const viewport = { w: size.width, h: size.height };
    const kept: { x: number; y: number }[] = [];
    return all.filter((memory) => {
      if (kept.length >= PHONE_NEIGHBOURS) return false;
      const seat = distancePreviewSeat(memory.index, memory.place, FIELD_FOCAL, viewport);
      if (kept.some((k) => Math.hypot(k.x - seat.x, k.y - seat.y) < PHONE_NEIGHBOUR_GAP)) return false;
      kept.push({ x: seat.x, y: seat.y });
      return true;
    });
    // the viewport is read once a phone is known: turning it keeps the same set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);
  return <>{memories.map(memory => <Neighbor key={memory.id} {...props} {...memory} />)}</>;
}

/** How many neighbours an upright phone shows, and the least room between their starting places (px). */
const PHONE_NEIGHBOURS = 8;
const PHONE_NEIGHBOUR_GAP = 80;
/** Over how many px a phone's neighbour fades as it rises past the top of the copy, into the header's ground. */
const PHONE_TOP_FADE = 48;

type NeighborProps = Context & { index: number; state: VesselState; place: ReturnType<typeof memoryFieldPlace> };

/** Its glass and cloth come from the shared build queue (vesselBuilds.ts) —
 * usually already built by the gallery — and it joins the shot once they are there. */
function Neighbor(props: NeighborProps) {
  const { state } = props;
  // after every gallery seat: the constellation is only seen at the distance step
  const parts = useVesselParts({
    form: state.form, morph: state.tune.morph, tune: state.tune, sheetMode: state.sheetMode, seed: state.seed, sheetSize: state.tune.sheetSize,
  }, 20 + props.index);
  return parts ? <NeighborBody {...props} parts={parts} /> : null;
}

function NeighborBody({ index, state, place, stage, anchor, depth: chosenDepth, shift, sceneTexture, edgePrint, parts }: NeighborProps & { parts: VesselParts }) {
  const root = useRef<THREE.Group>(null);
  const { camera, size, gl } = useThree();
  const built = useMemo(() => {
    const { glass, sheet } = parts;
    glass.geometry.computeBoundingBox();
    const box = glass.geometry.boundingBox!;
    const center = box.getCenter(new THREE.Vector3());
    let radius = 0;
    for (let i = 0; i < glass.positions.length; i += 3) radius += Math.hypot(glass.positions[i], glass.positions[i + 2]);
    radius /= Math.max(1, glass.positions.length / 3);
    // Match VesselArtifact's fitting: flat or deeply lobed forms must not be
    // enlarged to fill a seat by their tiny height alone.
    const reach = Math.max(.5, (box.max.y - box.min.y) / 2, radius * 1.45);
    glass.geometry.computeBoundingSphere();
    return { glass, sheet, center, height: 2 * reach * 1.12, radius: glass.geometry.boundingSphere!.radius };
  }, [parts]);
  const uniforms = useMemo(() => {
    const g = createGlassUniformSet(sceneTexture), s = createSheetUniformSet(edgePrint);
    const key = keyFrom(state.tune.keyAzimuth, state.tune.keyElevation);
    const haze = distancePreviewSeat(index, place, FIELD_FOCAL, { w: 1000, h: 800 }).haze;
    const tune = { ...state.tune, haze: 1 - (1 - state.tune.haze) * (1 - haze * .38), ground: 0 };
    const air = [0.8, 0.82, 0.82] as const;
    writeGlassUniforms(g, { tune, seed: state.seed, key, patches: seedDirections(state.seed, 3, 1.1), room: state.room, groundY: -100, reflect: -1, air });
    writeSheetUniforms(s, { tune, seed: state.seed, key, sheet: built.sheet, sheetMode: state.sheetMode, face: state.face, edgePrint, groundY: -100, reflect: -1, air });
    s.uPhoto.value = BLANK_PHOTO;
    s.uDevelop.value = 1.45;
    return { g, s };
  }, [state, built, sceneTexture, edgePrint, place, index]);
  useEffect(() => {
    let live = true;
    if (state.url) void loadSeatPhoto(state.url).then(photo => {
      if (live) { uniforms.s.uPhoto.value = photo.texture; uniforms.s.uImageAspect.value = photo.aspect; }
    }).catch(() => undefined);
    return () => { live = false; };
  }, [state.url, uniforms]);
  const vector = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    if (!root.current) return;
    root.current.visible = stage.current.step === "distance";
    if (!root.current.visible) return;
    const cam = camera as THREE.PerspectiveCamera;
    const distance = cam.position.distanceTo(anchor.current);
    // Follow the current memory in depth, leaving it fixed in the view. Every
    // other memory moves relative to that camera, eventually passing the eye.
    const bounds = stage.current.foregroundBounds;
    const seat = distancePreviewSeat(index, place, chosenDepth.current, { w: size.width, h: size.height },
      bounds ? { bounds, shift: shift.current ?? 0, radiusRatio: built.radius / built.height } : undefined);
    root.current.visible = seat.opacity > .001;
    if (!root.current.visible) return;
    const depth = distance * seat.depth / FIELD_FOCAL;
    const halfH = viewHalfTan(cam) * depth;
    const y = seat.y + (shift.current ?? 0) * size.height;
    vector.set((seat.x / size.width - .5) * 2 * halfH * cam.aspect, (.5 - y / size.height) * 2 * halfH, -depth);
    root.current.position.copy(vector.applyQuaternion(cam.quaternion).add(cam.position));
    root.current.quaternion.copy(cam.quaternion);
    root.current.rotateY(-state.tune.anchorAngle * Math.PI / 180);
    // fieldSeat caps projection at .3 near the eye; undo that cap as well so
    // the final fade never shrinks a neighbour's actual geometry.
    const sizeDepth = distance * Math.max(.3, seat.depth) / FIELD_FOCAL;
    const scale = seat.size / size.height * 2 * viewHalfTan(cam) * sizeDepth / built.height;
    root.current.scale.setScalar(scale);
    root.current.traverse(child => {
      if (child instanceof THREE.Mesh && child.layers.isEnabled(FRONT_LAYER)) child.renderOrder = 100 - seat.depth * 2;
    });
    // on an upright phone nothing rises into the header: a neighbour carried up
    // past the top of the copy as the field follows the memory fades there
    const copyTop = size.width <= 600 && size.width < size.height ? bounds?.top : undefined;
    const below = copyTop === undefined ? 1
      : Math.min(1, Math.max(0, (y - seat.size / 2 - (copyTop - PHONE_TOP_FADE)) / PHONE_TOP_FADE));
    uniforms.g.uReveal.value = uniforms.s.uReveal.value = seat.opacity * below;
    uniforms.g.uTime.value += dt;
    gl.getDrawingBufferSize(uniforms.g.uResolution.value);
  });
  return <group ref={root} visible={false}>
    <group position={[-built.center.x, -built.center.y, -built.center.z]}>
      <mesh geometry={built.glass.geometry} layers={FRONT_LAYER} renderOrder={100 - place.z * 2}>
        <shaderMaterial transparent depthWrite={false} side={THREE.BackSide} vertexShader={glassVertex} fragmentShader={glassRefractFragment} uniforms={uniforms.g} />
      </mesh>
      <mesh geometry={built.sheet.geometry} renderOrder={4}>
        <shaderMaterial transparent depthWrite={false} side={THREE.DoubleSide} vertexShader={sheetVertex} fragmentShader={sheetFragment} uniforms={uniforms.s} />
      </mesh>
      <mesh geometry={built.glass.geometry} layers={FRONT_LAYER} renderOrder={100 - place.z * 2}>
        <shaderMaterial transparent depthWrite={false} side={THREE.FrontSide} vertexShader={glassVertex} fragmentShader={glassRefractFragment} uniforms={uniforms.g} />
      </mesh>
    </group>
  </group>;
}
