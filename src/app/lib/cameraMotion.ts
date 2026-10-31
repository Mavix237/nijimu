/** Compare small, unstyled camera frames. Ignore sensor noise and uniform
 * exposure shifts so the film grain and auto-exposure don't trigger blur. */
export function cameraMotion(previous: Uint8ClampedArray, current: Uint8ClampedArray): number {
  if (previous.length !== current.length || !current.length) return 0;
  const pixels = current.length / 4;
  const luma = (frame: Uint8ClampedArray, i: number) => (frame[i] * 77 + frame[i + 1] * 150 + frame[i + 2] * 29) / 256;
  let exposureShift = 0;
  for (let i = 0; i < current.length; i += 4) exposureShift += luma(current, i) - luma(previous, i);
  exposureShift /= pixels;
  let movement = 0;
  for (let i = 0; i < current.length; i += 4) {
    movement += Math.max(0, Math.abs(luma(current, i) - luma(previous, i) - exposureShift) - 4);
  }
  const amount = Math.min(1, movement / pixels / 7);
  return amount * amount * (3 - 2 * amount);
}

export function cameraMotionEase(current: number, target: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dt) / (target > current ? .09 : .4)));
}

/** The moving endpoint preserves the original camera treatment. */
export function cameraMotionLook(motion: number) {
  const amount = Math.max(0, Math.min(1, motion));
  return { shutter: .045 + (.28 - .045) * amount, blur: .12 + (.6 - .12) * amount };
}
