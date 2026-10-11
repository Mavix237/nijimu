// Single source of truth for the memory color system.
// Previously duplicated verbatim in BlobScene, MemoryScrollPage,
// ConnectMemoriesPage, and EditColorPage.

/** Muted chrome gray — homescreen wordmark, top-right icons, hold-to-create hint. */
export const CHROME_GRAY = "#7e7e86";

/** Floating panes: an Exposure title, Rowan body, and Switzer options — the
 * option the pane hopes for in the darker ink, the way out in the lighter. */
export const PANE_INK = {
  title: "#6c6c75",
  body: CHROME_GRAY,
  primary: "#55555e",
  secondary: "#9b9ba3",
  secondaryHover: CHROME_GRAY,
  ring: "#aaaaaa",
} as const;

export interface PaletteEntry {
  id: string;
  color: string;
  light1: string;
  light2: string;
}

export const COLOR_PALETTE: PaletteEntry[] = [
  { id: "slate", color: "#9496a6", light1: "#c8d0d4", light2: "#d6dadb" },
  { id: "cloud", color: "#D6DADB", light1: "#e8eaeb", light2: "#c8d0d4" },
  { id: "mist", color: "#C8D0D4", light1: "#e0e4e6", light2: "#d6dadb" },
  { id: "sand", color: "#CBBFBC", light1: "#e5dbd9", light2: "#d6cbc8" },
  { id: "sky", color: "#A4B6BE", light1: "#c8d0d4", light2: "#d6dadb" },
  { id: "rose", color: "#B8969A", light1: "#d8c8ca", light2: "#e5dbd9" },
  { id: "sage", color: "#8C9FA8", light1: "#b8c4ca", light2: "#c8d0d4" },
  { id: "ocean", color: "#6488A0", light1: "#9cb4c8", light2: "#b8c8d4" },
  { id: "night", color: "#1C2C35", light1: "#4a5a62", light2: "#7a8a92" },
];

// Flat hex tints used by memoryData's LIFE_EVENTS color indices.
export const MEMORY_COLORS = [
  "#9496a6",
  "#D6DADB",
  "#C8D0D4",
  "#CBBFBC",
  "#A4B6BE",
  "#B8969A",
  "#8C9FA8",
  "#6488A0",
  "#9496a6",
  "#1C2C35",
];
