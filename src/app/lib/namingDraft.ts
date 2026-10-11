import type { NameFlowState, NamingSession } from "../components/NamingRim";
import type { ArchiveArtifact } from "./archive";
import { COLOR_PALETTE } from "./colors";
import type { SavedMemory } from "./memoryStore";
import { DEFAULT_ARTIFACT_FORM, formFromState } from "./superformula";

export function draftColorIndex(matPresetIndex: number | undefined): number {
  return Math.round(((matPresetIndex ?? 0) / 4) * (COLOR_PALETTE.length - 1));
}

export function draftShapeOf(state: NameFlowState | null): ArchiveArtifact["shape"] {
  return {
    form: formFromState(state) ?? state?.assignment?.form ?? DEFAULT_ARTIFACT_FORM,
    fluidity: state?.shape?.fluidity ?? 0,
    evolve: state?.shape?.evolve ?? 0.5,
    bumpAmount: state?.shape?.bumpAmount ?? 0,
  };
}

/** Transition motion must never replace the memory it carries. */
export function draftAsSaved(session: NamingSession): SavedMemory {
  const { state } = session;
  return {
    id: session.draftId, title: "", year: "",
    transcript: state.transcript ?? "",
    highlightedWords: state.highlightedWords ?? [],
    shape: { ...draftShapeOf(state), matPresetIndex: state.matPresetIndex ?? 0 },
    colorIndex: draftColorIndex(state.matPresetIndex),
    ...(state.assignment ? { assignment: state.assignment } : {}),
    ...(state.look ? { look: state.look } : {}),
    createdAt: "",
  };
}

export function draftArtifactOf(session: NamingSession): ArchiveArtifact {
  const draft = draftAsSaved(session);
  return { ...draft, event: draft.title };
}

/** Back resumes the handled memory in the current create shot, never a legacy lab. */
export function resumeColorState(state: NameFlowState) {
  return { ...state, rise: undefined, resumeStep: "color" as const,
    memoryAssignment: state.assignment, shape: draftShapeOf(state) };
}
