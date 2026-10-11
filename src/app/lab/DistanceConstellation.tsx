import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { buildArchive } from "../lib/archive";
import { galleryStateFor } from "./VesselGalleryPreview";
import { FIELD_FOCAL, distancePreviewSeat, memoryFieldPlace, type FieldTextBounds } from "./vesselField";
import { loadSeatPhoto } from "./VesselArtifact";
import { viewHalfTan } from "../lib/portraitView";
import {
  BLANK_PHOTO, FRONT_LAYER, buildGlass, buildDrapedSheet, buildSheet,
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
  const memories = useMemo(() => buildArchive().map((item, index) => ({
    id: item.id, index, state: galleryStateFor(item), place: memoryFieldPlace(index, item.look?.vividness),
  })), []);
  return <>{memories.map(memory => <Neighbor key={memory.id} {...props} {...memory} />)}</>;
}

function Neighbor({ index, state, place, stage, anchor, depth: chosenDepth, shift, sceneTexture, edgePrint }: Context & {
  index: number; state: VesselState; place: ReturnType<typeof memoryFieldPlace>;
}) {
  const root = useRef<THREE.Group>(null);
  const { camera, size, gl } = useThree();
  const built = useMemo(() => {
    const { tune: t, form, seed } = state;
    const glass = buildGlass(form, t.morph);
    const sheet = state.sheetMode === "draped" ? buildDrapedSheet(glass, t.inset, {
      sheetSize: t.sheetSize, anchorAngle: t.anchorAngle, anchorHeight: t.anchorHeight, tilt: t.tilt,
      contact: t.contact, sag: t.sag, peel: t.peel, curl: t.curl, twist: t.twist, gap: t.gap, soft: t.soft,
    }) : buildSheet(glass, t.inset, t.arc, t.band, t.lift, t.foldScale, seed);
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
  }, [state]);
  useEffect(() => () => { built.glass.geometry.dispose(); built.sheet.geometry.dispose(); }, [built]);
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
    uniforms.g.uReveal.value = uniforms.s.uReveal.value = seat.opacity;
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
