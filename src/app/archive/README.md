# Archived screens

The current create flow shares one canvas in `DescentFlow`:

```
/record/start → /record/transcript (read, highlight)
  → /record/descent (photo, hold, shape, rhythm, distance, feeling)
  → /record/name (PondNamingOverlay in LandingPage) → /memory
```

Current headings and naming fields use `FlowPageGrid`, with row positions in
`FLOW_PAGE` in `src/app/lib/theme.ts`. Navigation is a separate row above them.
`/lab/descent` previews the same scene with additional study controls.

## `shape-flow/`

Previous standalone shape, color, texture, and naming screens. The old
`/record/shape/:step` routes now redirect into `/record/descent`, preserving
carried state. Their home-screen shortcuts have been removed. `NameMemoryPage`
is retained only as the existing WebGL-failure fallback for the older
`PuddleScene` host; the live naming route uses `PondNamingOverlay`.

## `record-loop/`

Earlier recording/build/connect/orb screens, no longer routed. These include
RecordingStartPage, TranscriptPage, ShapeEditorPage, ShapeWeightPage,
ShapeColorPage's predecessors, and ConnectMemoriesPage. Restore experiments
only behind a dedicated lab route; do not replace the current create flow.
