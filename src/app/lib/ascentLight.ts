import { POND_SUN_GLSL } from "./pondLight";

const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The water picks up the sky first. The artifact stays clear through the first
 * half of the climb, then eases into a glow that accelerates near the surface. */
export function ascentLightAt(progress: number) {
  const p = Number.isFinite(progress) ? progress : 0;
  const incident = smooth(.04, .46, p);
  const gathering = Math.max(0, Math.min(1, (p - .52) / .48));
  return {
    incident,
    radiance: incident * 2.2 * gathering ** 4,
    atmosphere: .55 * (.18 * smooth(.22, .58, p) + .82 * gathering ** 2),
    blur: 28 * smooth(.58, .98, p) ** 1.3,
    ray: smooth(.52, .66, p) * (1 - smooth(.82, .98, p)),
    rayFill: smooth(.52, .84, p),
    bloom: smooth(.64, 1, p) ** 2,
    exposure: smooth(.88, 1, p),
  };
}

/** Returning from naming: keep the glass sharp through the surface crossing,
 * then soften it underwater. At sink .74 the shared pond camera is below y=0. */
export function surfaceReturnBlurAt(sink: number) {
  return 22 * smooth(.74, .90, Number.isFinite(sink) ? sink : 0);
}

/** Surface transmission shared by the water, glass and contained interior ray. */
export const ASCENT_LIGHT_GLSL = /* glsl */ `
  ${POND_SUN_GLSL}
  uniform float uAscentIncident;
  uniform float uAscentRadiance;
  uniform float uAscentAtmosphere;
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

/** Integrate a soft ray inside the vessel's visible silhouette. Only the near
 * glass wall evaluates this, so it is neither doubled nor drawn over the water. */
export const ASCENT_INTERIOR_GLSL = /* glsl */ `
  uniform float uAscentRay;
  uniform float uAscentRayFill;
  uniform float uMemoryRadius;
  float ascentInterior(vec3 world, vec3 normal) {
    if (uAscentRay < .001 || dot(normal, cameraPosition - world) <= 0.0) return 0.0;
    float radius = max(.1, uMemoryRadius);
    vec3 direction = normalize(world - cameraPosition);
    vec3 entry = (world - uMemoryPosition) / radius;
    float travel = max(0.0, -2.0 * dot(entry, direction));
    vec3 light = pondTransmittedLight();
    float width = .045 + .50 * pow(uAscentRayFill, 3.0);
    float tip = 1.05 - 2.2 * uAscentRayFill;
    float gathered = 0.0;
    for (int i = 0; i < 16; i++) {
      vec3 q = entry + direction * travel * (float(i) + .5) / 16.0;
      float along = dot(q, light);
      vec3 across = q - light * along;
      float core = exp(-dot(across, across) / (2.0 * width * width));
      float filling = smoothstep(tip - .16, tip + .12, along);
      float inside = 1.0 - smoothstep(.72, 1.0, length(q));
      gathered += core * filling * inside;
    }
    return gathered * travel / 16.0 * uAscentRay * .9;
  }
`;
