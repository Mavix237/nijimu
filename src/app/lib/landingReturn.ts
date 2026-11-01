import { createContext, useContext } from "react";
import { PAPER_RETURN } from "./atmosphere";

/** Exit-to-landing choreography: popup, then the scene, then the field, then the header. */
export const LANDING_RETURN = {
  profileLeaveMs: 220,
  sceneFadeMs: 780,
  holdMs: 140,
  contentFadeMs: 920,
  headerDelayMs: 1280,
  headerFadeMs: 1100,
} as const;

/** The return veil: between the gallery's ground (#edecec) and the landing's paper (#f4f5f5 → #ecebeb). */
export const LANDING_PAPER = PAPER_RETURN;

export type LandingReturnPhase = "idle" | "scene-out" | "holding" | "landing";

export interface LandingReturnApi {
  phase: LandingReturnPhase;
  beginReturn: () => void;
}

export const LandingReturnContext = createContext<LandingReturnApi>({
  phase: "idle",
  beginReturn: () => {},
});

export function useLandingReturn() {
  return useContext(LandingReturnContext);
}
