/**
 * Photographic settings for the render menu. Every value is neutral: with
 * these defaults the scene is drawn exactly as it was, and nothing here is
 * applied until a control moves or an export asks for it.
 *
 * Focal length is millimetres on a 24mm-tall full-frame sensor, the same
 * vertical field three.js cameras already use. Null means each camera keeps
 * the fov its scene set.
 */

export type LutId = "off" | "print" | "portrait";
export type ExportPreset = "1080p" | "2k" | "4k" | "8k" | "custom";
export type ExportFormat = "png" | "jpg";

export type GradeSettings = {
  /** Null keeps every camera's own fov. */
  focalMm: number | null;
  /** Dolly so the framed subject stays the same size when the lens changes. */
  holdSubject: boolean;
  /** f/16 is sharp. Lower stops open the aperture. */
  fStop: number;
  /** World-unit focus used when focus is not following the camera's target. */
  focus: number;
  focusAuto: boolean;
  /** 0 is a sharp lens. */
  softness: number;
  /** 0 is no colour fringing. */
  aberration: number;
  /** Exposure in stops. */
  exposure: number;
  contrast: number;
  /** 0 leaves highlights linear. */
  rolloff: number;
  /** Kelvin. 6500 is the scene's own white. */
  temperature: number;
  saturation: number;
  lut: LutId;
  grain: number;
  grainSize: number;
  /** 0 is even grain. Higher keeps it in the midtones. */
  grainTone: number;
  /** 0 ignores local contrast. */
  grainContrast: number;
  halation: number;
  paper: number;
  preset: ExportPreset;
  customW: number;
  customH: number;
  format: ExportFormat;
  jpgQuality: number;
};

export const GRADE_DEFAULTS: GradeSettings = {
  focalMm: null,
  holdSubject: true,
  fStop: 16,
  focus: 8,
  focusAuto: true,
  softness: 0,
  aberration: 0,
  exposure: 0,
  contrast: 0,
  rolloff: 0,
  temperature: 6500,
  saturation: 0,
  lut: "off",
  grain: 0,
  grainSize: 1,
  grainTone: 0.72,
  grainContrast: 0.4,
  halation: 0,
  paper: 0,
  preset: "4k",
  customW: 3840,
  customH: 2160,
  format: "jpg",
  jpgQuality: 0.92,
};

/** Long edge of a preset, in pixels. 2K is QHD (2560), between 1080p and 4K. */
export const EXPORT_LONG: Record<Exclude<ExportPreset, "custom">, number> = {
  "1080p": 1920,
  "2k": 2560,
  "4k": 3840,
  "8k": 7680,
};

export const SENSOR_HEIGHT_MM = 24;
/** Fixed seed so a still export repeats and the preview matches it. */
export const GRAIN_SEED = 17.13;

const listeners = new Set<() => void>();
let settings: GradeSettings = { ...GRADE_DEFAULTS };
let menuOpen = false;
let exporting = false;
/** Settings frozen at the moment an export starts, so a drag mid-export cannot change the file. */
let frozen: GradeSettings | null = null;

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeGrade(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getGrade(): GradeSettings {
  return settings;
}

/** What the picture should use. An export keeps the values it started with. */
export function readGrade(): GradeSettings {
  return frozen ?? settings;
}

export function gradeSession(): boolean {
  return menuOpen || exporting;
}

/** True while an export is holding the settings it started with. */
export function gradeFrozen(): boolean {
  return frozen !== null;
}

export function gradeMenuOpen(): boolean {
  return menuOpen;
}

export function patchGrade(partial: Partial<GradeSettings>) {
  settings = { ...settings, ...partial };
  emit();
}

export function resetGrade() {
  settings = { ...GRADE_DEFAULTS };
  emit();
}

export function setGradeMenu(open: boolean) {
  menuOpen = open;
  emit();
}

export function beginGradeExport() {
  frozen = settings;
  exporting = true;
  emit();
}

export function endGradeExport() {
  frozen = null;
  exporting = false;
  emit();
}

export function focalFromFov(fovDeg: number): number {
  const half = (fovDeg * Math.PI) / 360;
  const t = Math.tan(half);
  if (!Number.isFinite(t) || t < 1e-4) return 200;
  return SENSOR_HEIGHT_MM / (2 * t);
}

export function fovFromFocal(mm: number): number {
  const half = Math.atan(SENSOR_HEIGHT_MM / (2 * Math.max(1, mm)));
  return (half * 360) / Math.PI;
}

export function lensActive(grade: GradeSettings = readGrade()): boolean {
  return grade.focalMm != null;
}

export function depthActive(grade: GradeSettings = readGrade()): boolean {
  return grade.fStop < 15.95;
}

export function pixelActive(grade: GradeSettings = readGrade()): boolean {
  if (!gradeSession()) return false;
  return depthActive(grade)
    || grade.softness > 0.001
    || grade.aberration > 0.001
    || Math.abs(grade.exposure) > 0.001
    || Math.abs(grade.contrast) > 0.001
    || grade.rolloff > 0.001
    || Math.abs(grade.temperature - 6500) > 1
    || Math.abs(grade.saturation) > 0.001
    || grade.lut !== "off"
    || grade.grain > 0.001
    || grade.halation > 0.001
    || grade.paper > 0.001;
}

/** Tanner Helland's black-body approximation, then held to 1 at 6500K so the default adds no tint and no exposure. */
export function kelvinGain(kelvin: number): [number, number, number] {
  const rgb = kelvinToRgb(kelvin);
  const ref = kelvinToRgb(6500);
  const gain: [number, number, number] = [
    rgb[0] / Math.max(1e-4, ref[0]),
    rgb[1] / Math.max(1e-4, ref[1]),
    rgb[2] / Math.max(1e-4, ref[2]),
  ];
  const luma = 0.2126 * gain[0] + 0.7152 * gain[1] + 0.0722 * gain[2];
  if (luma < 1e-4) return [1, 1, 1];
  return [gain[0] / luma, gain[1] / luma, gain[2] / luma];
}

function kelvinToRgb(kelvin: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return [c(r), c(g), c(b)];
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
