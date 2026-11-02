import { useEffect, useMemo } from "react";
import { DialRoot, useDialKit } from "dialkit";
import "dialkit/styles.css";
import { DIALS_OPEN } from "../lib/dialsOpen";
import { NAMING_TUNE_DEFAULT, setNamingTune, type NamingTune, type NamingLightTune } from "../lib/namingTune";

/*
 * The naming step's dev panel (DialKit). Development only: PondNamingOverlay
 * imports it lazily behind import.meta.env.DEV. One shell, bottom right:
 * layout (the vessel's lift and size, the words' lift and gaps), the room the
 * glass reflects, its light near & clear / far & faded, its reflection on the
 * lake, and the memory's colour in the lake round it. Values persist in
 * localStorage (dialkit:nijimu-naming); "Copy" in the version menu puts a set
 * on the clipboard to write back into NAMING_TUNE_DEFAULT (lib/namingTune.ts).
 */

type Range = [number, number, number, number];
const D = NAMING_TUNE_DEFAULT;

const lightFolder = (l: NamingLightTune, collapsed: boolean) => ({
  _collapsed: collapsed,
  envAbove: [l.envAbove, 0, 2, 0.01] as Range,
  envBelow: [l.envBelow, 0, 2, 0.01] as Range,
  thickDark: [l.thickDark, 0, 1, 0.01] as Range,
  rim: [l.rim, 0, 1.5, 0.01] as Range,
  highlight: [l.highlight, 0, 2, 0.01] as Range,
  keyIntensity: [l.keyIntensity, 0, 3, 0.01] as Range,
});

const CONFIG = {
  layout: {
    _collapsed: false,
    artifactLift: [D.layout.artifactLift, -10, 25, 0.1] as Range,
    artifactScale: [D.layout.artifactScale, 0.6, 2, 0.01] as Range,
    textLift: [D.layout.textLift, -10, 25, 0.1] as Range,
    fieldGap: [D.layout.fieldGap, 0, 120, 1] as Range,
    passageGap: [D.layout.passageGap, 0, 160, 1] as Range,
  },
  room: { _collapsed: true, above: D.room.above, below: D.room.below },
  light: lightFolder(D.light, true),
  lightFar: lightFolder(D.lightFar, true),
  // the vessel mirrored on the lake
  reflection: {
    _collapsed: false,
    strength: [D.reflection.strength, 0, 1, 0.01] as Range,
    fall: [D.reflection.fall, 0.05, 6, 0.01] as Range,
    gap: [D.reflection.gap, 0, 0.6, 0.005] as Range,
    soft: [D.reflection.soft, 0, 12, 0.05] as Range,
    smear: [D.reflection.smear, 0, 5, 0.05] as Range,
    room: [D.reflection.room, 0, 1.2, 0.01] as Range,
    ripple: [D.reflection.ripple, 0, 4, 0.01] as Range,
    stretch: [D.reflection.stretch, 0.2, 5, 0.05] as Range,
    fresnel: [D.reflection.fresnel, 0, 1, 0.01] as Range,
    tint: [D.reflection.tint, 0, 1, 0.01] as Range,
    darken: [D.reflection.darken, 0, 0.6, 0.005] as Range,
    contact: [D.reflection.contact, 0, 0.6, 0.005] as Range,
    contactSharp: [D.reflection.contactSharp, 0, 1, 0.01] as Range,
    contactStrength: [D.reflection.contactStrength, 0, 1.5, 0.01] as Range,
  },
  // the memory's colour round the reflection, if it is not the water's own blue
  lake: {
    _collapsed: false,
    amount: [D.lake.amount, 0, 1.5, 0.01] as Range,
    boost: [D.lake.boost, 0, 6, 0.05] as Range,
    wash: [D.lake.wash, 0, 1, 0.01] as Range,
    offsetY: [D.lake.offsetY, -0.6, 0.8, 0.01] as Range,
    radiusX: [D.lake.radiusX, 0.1, 3, 0.01] as Range,
    radiusY: [D.lake.radiusY, 0.05, 2, 0.01] as Range,
    falloff: [D.lake.falloff, 0.2, 5, 0.05] as Range,
    guard: [D.lake.guard, 0, 120, 1] as Range,
    guardSoft: [D.lake.guardSoft, 1, 120, 1] as Range,
    minChroma: [D.lake.minChroma, 0, 0.08, 0.001] as Range,
    spot: [D.lake.spot, 0, 1, 0.01] as Range,
    spotRadiusX: [D.lake.spotRadiusX, 0.02, 1.5, 0.005] as Range,
    spotRadiusY: [D.lake.spotRadiusY, 0.01, 0.6, 0.005] as Range,
    spotFalloff: [D.lake.spotFalloff, 0.2, 5, 0.05] as Range,
    spotRipple: [D.lake.spotRipple, 0, 0.1, 0.001] as Range,
  },
};

type Values = { [K in keyof NamingTune]: Partial<NamingTune[K]> };

export default function NamingDials() {
  const v = useDialKit("naming", CONFIG as never, { id: "nijimu-naming", persist: true }) as unknown as Values;
  const key = JSON.stringify(v);
  const tune = useMemo<NamingTune>(() => ({
    layout: { ...D.layout, ...v.layout },
    room: { ...D.room, ...v.room },
    light: { ...D.light, ...v.light },
    lightFar: { ...D.lightFar, ...v.lightFar },
    reflection: { ...D.reflection, ...v.reflection },
    lake: { ...D.lake, ...v.lake },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [key]);

  useEffect(() => { setNamingTune(tune); }, [tune]);
  useEffect(() => () => setNamingTune(D), []);

  return <DialRoot defaultOpen={DIALS_OPEN} position="bottom-right" theme="light" panels={["naming"]} />;
}
