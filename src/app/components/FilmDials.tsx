import { useEffect, useMemo } from "react";
import { DialRoot, useDialKit } from "dialkit";
import "dialkit/styles.css";
import { DIALS_OPEN } from "../lib/dialsOpen";
import { FILM_TUNE_DEFAULT, setFilmTune, type FilmTune } from "../lib/filmTune";

/*
 * The photo's film look on every vessel (DialKit, development only): the
 * light leak, the warmth, halation, crossover and bloom (lib/filmTune.ts).
 * Mounted by the descent while a vessel is in hand and by naming. Values
 * persist in localStorage (dialkit:nijimu-film); "Copy" puts a set on the
 * clipboard to write back into FILM_TUNE_DEFAULT.
 */

type Range = [number, number, number, number];
const D = FILM_TUNE_DEFAULT;
const CONFIG = {
  leak: [D.leak, 0, 1.5, 0.01] as Range,
  cool: [D.cool, 0, 1, 0.01] as Range,
  halation: [D.halation, 0, 0.6, 0.005] as Range,
  split: [D.split, 0, 1, 0.01] as Range,
  bloom: [D.bloom, 0, 2, 0.01] as Range,
};

export default function FilmDials({ position = "bottom-right" }: { position?: "bottom-right" | "bottom-left" | "top-left" | "top-right" }) {
  const v = useDialKit("vessel film", CONFIG as never, { id: "nijimu-film", persist: true }) as unknown as Partial<FilmTune>;
  const key = JSON.stringify(v);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tune = useMemo<FilmTune>(() => ({ ...D, ...v }), [key]);
  useEffect(() => { setFilmTune(tune); }, [tune]);
  useEffect(() => () => setFilmTune(D), []);
  return <DialRoot defaultOpen={DIALS_OPEN} position={position} theme="light" panels={["vessel film"]} />;
}
