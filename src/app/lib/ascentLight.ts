import { POND_SUN_GLSL } from "./pondLight";

const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Surface illumination reaches the upper glass first. The vessel then becomes
 * luminous enough to bloom through the water, before the final exposure lifts. */
export function ascentLightAt(progress: number) {
  const p = Number.isFinite(progress) ? progress : 0;
  const incident = smooth(.04, .46, p);
  const gathering = smooth(.24, .94, p);
  return {
    incident,
    radiance: incident * (.18 + 16 * gathering ** 4),
    bloom: smooth(.30, .94, p),
    exposure: smooth(.78, 1, p),
  };
}

/** Broad transmitted skylight, never a cone or a separate luminous ray. */
export const ASCENT_LIGHT_GLSL = /* glsl */ `
  ${POND_SUN_GLSL}
  uniform float uAscentIncident;
  uniform float uAscentRadiance;
  uniform vec3 uMemoryPosition;
  float ascentIllumination(vec3 p, vec3 normal) {
    vec3 light = pondTransmittedLight();
    float facing = max(0.0, dot(normal, light));
    // Refracted light catches the crown first, then transmits through the body.
    // Broad normal shading preserves the folds instead of painting a white disk.
    float crown = smoothstep(-.6, .65, p.y - uMemoryPosition.y);
    float transmission = .12 + .24 * uAscentIncident;
    return (transmission + facing * .85) * (.4 + .6 * crown);
  }
`;
