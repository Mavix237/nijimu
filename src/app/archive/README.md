# Archived screens

The current create flow shares one canvas in `DescentFlow`:

```
/record/start → /record/descent (photo, hold, shape, rhythm, distance, feeling)
  → /record/name (PondNamingOverlay in LandingPage) → /memory
```

`/record/transcript` redirects into `/record/descent`. The highlight screen is
in `highlight-transcript/`.

Current headings and naming fields use `FlowPageGrid`, with row positions in
`FLOW_PAGE` in `src/app/lib/theme.ts`. Navigation is a separate row above them.
`/lab/descent` previews the same scene with additional study controls.

## `color-spectrum-2026-10-10/`

The separate [`color-spectrum-2026-10-10/`](color-spectrum-2026-10-10/README.md)
snapshot preserves the underwater colour page before the homescreen-palette field
experiment. It includes the owning scene and original colour field/mapping.

## `shape-flow/`

Previous standalone shape, color, texture, and naming screens. The old
`/record/shape/:step` routes now redirect into `/record/descent`, preserving
carried state. Their home-screen shortcuts have been removed. `NameMemoryPage`
is retained only as the existing WebGL-failure fallback for the older
`PuddleScene` host; the live naming route uses `PondNamingOverlay`.

## `highlight-transcript/`

The spoken-word screen (`PuddleTranscriptPage`): the transcript types in, then
a drag highlights up to two words at a time. It is not routed. Curated
`highlightedWords` remain on each memory; the gallery trail does not ink them.

## `record-loop/`

Earlier recording/build/connect/orb screens, no longer routed. These include
RecordingStartPage, TranscriptPage, ShapeEditorPage, ShapeWeightPage,
ShapeColorPage's predecessors, and ConnectMemoriesPage. Restore experiments
only behind a dedicated lab route; do not replace the current create flow.
