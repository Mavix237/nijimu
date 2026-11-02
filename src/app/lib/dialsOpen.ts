import { LIGHT_TIER } from "./deviceTier";
import { COMPACT_QUERY } from "../hooks/useCompact";

/** Whether the dev DialKit panels open expanded. On a phone (or a phone-width
    window) they start folded, so they do not cover the screen; a tap on a
    panel's header still opens it. Decided once at load. */
export const DIALS_OPEN = !(LIGHT_TIER || window.matchMedia(COMPACT_QUERY).matches);
