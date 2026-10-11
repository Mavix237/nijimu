/** One sun direction for the pond's reflection and its transmitted underwater light. */
export const POND_SUN_GLSL = /* glsl */ `
  #ifndef NIJIMU_POND_SUN
  #define NIJIMU_POND_SUN
  vec3 pondSunDirection() { return normalize(vec3(0.0, .24, -1.0)); }
  vec3 pondTransmittedLight() {
    return -refract(-pondSunDirection(), vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
  }
  #endif
`;
