/** Guards a post pass against a stray NaN/Inf pixel. One non-finite texel is a
 * single dark dot on screen, but a separable blur spreads it over every tap
 * into a black square. The test reads the exponent bits, so a GPU compiling
 * with fast math (Metal, which may drop isnan()) still sees it. */
export const FINITE_GLSL = /* glsl */ `
  bool nonFinite(vec4 c) {
    return any(equal(floatBitsToUint(c) & 0x7f800000u, uvec4(0x7f800000u)));
  }
  vec4 finite4(vec4 c) { return nonFinite(c) ? vec4(0.0) : c; }
`;
