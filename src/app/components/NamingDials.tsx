import { useEffect, useMemo } from "react";
import { DialRoot, useDialKit } from "dialkit";
import "dialkit/styles.css";
import { NAMING_TUNE_DEFAULT, setNamingTune, type NamingTune, type NamingLightTune } from "../lib/namingTune";

/*
 * The naming step's dev panel (DialKit). Development only: PondNamingOverlay
 * imports it lazily behind import.meta.env.DEV. One shell, bottom right:
 * layout (the vessel's lift and size, the words' lift and gaps), the room the
 * glass reflects, and its light near & clear / far & faded. Values persist in
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [key]);

  useEffect(() => { setNamingTune(tune); }, [tune]);
  useEffect(() => () => setNamingTune(D), []);

  return <DialRoot position="bottom-right" theme="light" panels={["naming"]} />;
}
