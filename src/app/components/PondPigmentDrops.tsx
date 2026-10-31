import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { POND_PROMPT_PERIOD, POND_THOUGHTS, type PondPromptCue } from "../lib/pondPrompts";
import { POND_DROP_ANGLE_DEG, POND_DROP_FALL_S, POND_DROP_RADIUS, POND_DROP_FRAGMENT, POND_DROP_SINK_S, POND_DROP_VERTEX,
  POND_INK_SCALE, POND_INK_SLOTS, inkHang, inkHead,
  POND_PIGMENTS, dropSpeed, dropTravel, pigmentDeepFor, pigmentFor, pigmentLightFor, pondToneCrossfade,
  type PondPigmentUniforms } from "../lib/pondPigment";

/** The way back along the fall, toward where the drops come from, in screen
 * px (y down): the top of the screen turned clockwise by the drop angle
 * (anticlockwise when it is negative). */
const ANGLE = POND_DROP_ANGLE_DEG * Math.PI / 180;
const SOURCE = new THREE.Vector2(Math.sin(ANGLE), -Math.cos(ANGLE));
/** The teardrop's length behind its foot, in outline units, at rest and at most. */
const LENGTH = 2.6, LENGTH_MAX = 3.2;
/** How long the eye's "shutter" is open: the drop smears back along its way
 * as far as it travels in this time. Seconds. */
const SHUTTER_S = .025;
/** The longest smear, in outline units. */
const BLUR_MAX = 9;

/**
 * The prompts' drops of paint: each comes in on a slant from beyond the edge
 * of the frame onto its prompt's place, at one even speed, and lands as the
 * cue's ripple begins, leaving its ink in the water's ink slots. A drop is
 * drawn flat, in screen space, at the size it would be where it lands. Two at
 * most are in the air (this prompt's, before it lands, and the next one's).
 * With `active` off no new drop falls, ink that has not landed yet is let go,
 * and the water's tone returns to its own; ink already in the water stays
 * until it has faded.
 */
export function PondPigmentDrops({ waves, cueRef, active, narrow }: {
  waves: PondPigmentUniforms & { uTime: { value: number } };
  cueRef: RefObject<PondPromptCue>;
  active: boolean;
  /** Phones put every prompt on the centre line. */
  narrow: boolean;
}) {
  const { camera, size, gl } = useThree();
  const buffer = useMemo(() => new THREE.Vector2(), []);
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const offset = useMemo(() => Math.floor(Math.random() * POND_PIGMENTS.length), []);
  const drops = useRef<Array<THREE.Mesh | null>>([]);
  const materials = useMemo(() => [0, 1].map(() => ({
    uTint: { value: new THREE.Vector3() },
    uOpacity: { value: .94 },
    uCenter: { value: new THREE.Vector2() },
    uViewport: { value: new THREE.Vector2(1, 1) },
    uDir: { value: SOURCE.clone() },
    uSize: { value: 6 },
    uLength: { value: LENGTH },
    uBlur: { value: 0 },
    uSoft: { value: 2 },
    uSeed: { value: 0 },
  })), []);
  const probe = useMemo(() => new THREE.Vector3(), []);
  const ray = useMemo(() => new THREE.Vector3(), []);
  const lift = useMemo(() => new THREE.Vector3(), []);
  // The ink slot each landing was given, by the time it lands.
  const landed = useRef<{ at: number; slot: number }>({ at: -1e9, slot: -1 });
  const nextSlot = useRef(0);
  // The tint the water wore when the latest drop landed, crossed from.
  const toneFrom = useMemo(() => ({ tone: new THREE.Vector4(1, 1, 1, 0), deep: new THREE.Vector3(1, 1, 1) }), []);
  const placeOf = (cycle: number) => {
    const thought = POND_THOUGHTS[cycle % POND_THOUGHTS.length];
    return { x: narrow ? 0 : thought.x, z: thought.z };
  };

  useEffect(() => () => { waves.uPondLife.value = 0; waves.uPondTone.value.w = 0; }, [waves]);

  useFrame((_, delta) => {
    const time = waves.uTime.value;
    const cue = cueRef.current;
    const dt = Math.min(delta, .05);
    waves.uPondLife.value = Math.min(1, waves.uPondLife.value + dt / .6);
    const impact = time - cue.age;
    const tone = waves.uPondTone.value;
    if (active) {
      // A landing not seen before takes the oldest slot; one seen before keeps
      // its slot and follows the cue's clock.
      if (Math.abs(impact - landed.current.at) > .5) {
        landed.current = { at: impact, slot: nextSlot.current++ % POND_INK_SLOTS };
        toneFrom.tone.copy(tone);
        const d = waves.uPondToneDeep.value;
        toneFrom.deep.set(d.x, d.y, d.z);
      }
      landed.current.at = impact;
      const { x, z } = placeOf(cue.cycle);
      const tint = pigmentFor(cue.cycle, offset);
      waves.uInk.value[landed.current.slot].set(x, z, impact, 1);
      // the ink is the drop's paint thinned in the water, a little lighter
      const ink = pigmentLightFor(cue.cycle, offset);
      waves.uInkTint.value[landed.current.slot].set(ink.x, ink.y, ink.z, (cue.cycle * 7.31 + offset) % 10);
      // Cross from the tint the water wore to this drop's; from clear water
      // the colour simply comes in.
      const deep = pigmentDeepFor(cue.cycle, offset);
      const fresh = toneFrom.tone.w < .01;
      const e = pondToneCrossfade(cue.age);
      const mixed = (from: number, to: number) => fresh ? to : from + (to - from) * e;
      tone.set(mixed(toneFrom.tone.x, tint.x), mixed(toneFrom.tone.y, tint.y), mixed(toneFrom.tone.z, tint.z),
        toneFrom.tone.w + (1 - toneFrom.tone.w) * e);
      gl.getDrawingBufferSize(buffer);
      waves.uPondToneDeep.value.set(mixed(toneFrom.deep.x, deep.x), mixed(toneFrom.deep.y, deep.y),
        mixed(toneFrom.deep.z, deep.z), buffer.y);
    } else {
      if (landed.current.slot >= 0 && waves.uInk.value[landed.current.slot].z > time) {
        waves.uInk.value[landed.current.slot].w = 0;
      }
      tone.w *= Math.exp(-dt / .8);
    }
    for (let k = 0; k < 2; k++) {
      const drop = drops.current[k];
      if (!drop) continue;
      const untilImpact = impact + k * POND_PROMPT_PERIOD - time;
      const falling = active && untilImpact > 0 && untilImpact < POND_DROP_FALL_S;
      // Once in, the drop is still seen going down to where the ink's head is
      // and coming apart into it.
      const sinking = active && k === 0 && untilImpact <= 0 && -untilImpact < POND_DROP_SINK_S;
      drop.visible = falling || sinking;
      if (!falling && !sinking) continue;
      const cycle = cue.cycle + k;
      const { x, z } = placeOf(cycle);
      // Where it lands, on screen, and how large a drop is seen there.
      probe.set(x, 0, z).project(camera);
      lift.set(x, POND_DROP_RADIUS, z).project(camera);
      const ix = (probe.x * .5 + .5) * size.width, iy = (-probe.y * .5 + .5) * size.height;
      const radius = Math.max(3.5, Math.hypot(lift.x - probe.x, lift.y - probe.y) * .5 * size.height * 1.15);
      // Far enough back along the slant that the whole drop starts off screen.
      const toSide = SOURCE.x > 1e-3 ? (size.width - ix) / SOURCE.x : SOURCE.x < -1e-3 ? ix / -SOURCE.x : Infinity;
      const toTop = SOURCE.y < -1e-3 ? iy / -SOURCE.y : Infinity;
      const entry = Math.min(toSide, toTop) + radius * (LENGTH_MAX + BLUR_MAX + 2);
      const speed = dropSpeed(entry);
      const m = materials[k];
      m.uViewport.value.set(size.width, size.height);
      // the drop carries the paint at its deepest, as the vessels' foot band does
      m.uTint.value.copy(pigmentDeepFor(cycle, offset));
      // a little out of focus, a touch more the farther it still has to fall
      const soft = (.8 + radius * .22) * (1 + .2 * Math.min(1, Math.max(0, untilImpact) / POND_DROP_FALL_S));
      if (falling) {
        const travel = dropTravel(untilImpact, entry);
        m.uCenter.value.set(ix + SOURCE.x * travel, iy + SOURCE.y * travel);
        m.uSize.value = radius;
        // drawn out a little by its speed, and smeared by it
        m.uLength.value = Math.min(LENGTH_MAX, LENGTH + speed / Math.max(1, size.height) * .3);
        m.uBlur.value = Math.min(BLUR_MAX, speed * SHUTTER_S / radius);
        m.uSoft.value = soft;
        m.uOpacity.value = .94;
      } else {
        // Seen through the surface where the ink's head is: the same place the
        // shader draws it, down the refracted ray from above it, let hang.
        const age = -untilImpact, s = age / POND_DROP_SINK_S;
        ray.set(x, 0, z).sub(camera.position).normalize();
        const cosi = -ray.y, eta = 1 / 1.333;
        const kk = 1 - eta * eta * (1 - cosi * cosi);
        const ry = eta * ray.y + (eta * cosi - Math.sqrt(Math.max(0, kk)));
        const away = Math.min(-.05, eta * ray.z / Math.max(.3, -ry));
        const hang = inkHang(Math.hypot(camera.position.x - x, camera.position.z - z));
        probe.set(x, 0, z + inkHead(age) * -away * hang * POND_INK_SCALE).project(camera);
        m.uCenter.value.set((probe.x * .5 + .5) * size.width, (-probe.y * .5 + .5) * size.height);
        // checked by the water at once: it rounds, swells a little as it
        // loosens, softens and thins into the ink
        const check = 1 - Math.exp(-age / .12);
        m.uSize.value = radius * (1 + .6 * s);
        m.uLength.value = LENGTH + (.75 - LENGTH) * check;
        m.uBlur.value = Math.min(BLUR_MAX, speed * SHUTTER_S / radius) * Math.exp(-age / .06);
        m.uSoft.value = soft * (1 + 2.5 * s);
        m.uOpacity.value = .94 * Math.pow(1 - s, 1.6);
      }
      m.uSeed.value = (cycle * 2.7) % 6.28;
    }
  });

  return <>
    {[0, 1].map(k => <mesh key={k} ref={el => { drops.current[k] = el; }} geometry={geometry} visible={false}
      renderOrder={5} frustumCulled={false}>
      <shaderMaterial transparent depthTest={false} depthWrite={false} vertexShader={POND_DROP_VERTEX}
        fragmentShader={POND_DROP_FRAGMENT} uniforms={materials[k]} />
    </mesh>)}
  </>;
}
