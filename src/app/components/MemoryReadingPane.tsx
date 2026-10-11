import { useState } from "react";
import { CHROME_GRAY } from "../lib/colors";
import { BODY_SIZE, NOTE_SIZE, SERIF, SERIF_CJK, SERIF_ITALIC_TRACKING } from "../lib/theme";
import { GlassPane } from "./GlassPane";
import { PaneOption, PaneOptions } from "./PaneOption";

/** The space GlassPane keeps between its rows when centred (its `gap`). */
const PANE_GAP = "clamp(20px, 4vh, 30px)";

export interface ReadableMemory {
  id: string;
  /** The name and year head the pane; naming opens it before they are kept, words only. */
  event?: string;
  year?: string;
  transcript: string;
}

/**
 * A memory's whole text, on a phone: the gallery there shows only the name
 * and year under the vessel, and pressing the vessel opens this. The same
 * glass pane as the profile, at a reading height, scrolling inside;
 * the name and year set as the gallery's caption sets them (the name at the
 * size of the words), the words left-aligned below. On the naming step the
 * memory has no name or year yet, and the pane holds the words alone.
 */
export function MemoryReadingPane({ memory, onClose }: { memory: ReadableMemory | null; onClose: () => void }) {
  // the last memory stays in the pane while it leaves
  const [shown, setShown] = useState<ReadableMemory | null>(memory);
  if (memory && memory !== shown) setShown(memory);
  const words = shown?.transcript.trim() ?? "";
  const titled = !!(shown?.event || shown?.year);

  return (
    <GlassPane open={!!memory} onClose={onClose} onExited={() => setShown(null)}
      labelledBy={titled ? "memory-reading-title" : undefined} label="the words of this memory" tall>
      {shown && (
        <>
          {titled && <header style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
            <h2
              id="memory-reading-title"
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontStyle: "italic",
                fontWeight: 400,
                // the size of the words below it: the name leads by its italic, not its scale
                fontSize: BODY_SIZE,
                letterSpacing: SERIF_ITALIC_TRACKING,
                lineHeight: 1.4,
                color: CHROME_GRAY,
                textAlign: "center",
                textWrap: "balance",
                overflowWrap: "anywhere",
                whiteSpace: "pre-line",
              }}
            >
              {shown.event}
            </h2>
            <p
              style={{
                margin: 0,
                fontFamily: SERIF_CJK,
                fontSize: NOTE_SIZE,
                fontWeight: 400,
                lineHeight: 1.35,
                letterSpacing: "0.04em",
                color: "#999",
              }}
            >
              {shown.year}
            </p>
          </header>}

          <p
            lang="en"
            style={{
              // no rule between name and words; three quarters of the space it
              // held (gap + rule + gap) stays: one pane gap, plus half of one here
              margin: titled ? `calc(${PANE_GAP} * 0.5 + 0.75px) 0 0` : 0,
              width: "100%",
              maxWidth: "34em",
              fontFamily: SERIF,
              fontSize: BODY_SIZE,
              fontWeight: 400,
              lineHeight: 1.7,
              color: "#7b7b87",
              textAlign: "left",
              overflowWrap: "break-word",
              whiteSpace: "pre-line",
            }}
          >
            {words || "no words were kept with this memory."}
          </p>

          {/* at the foot of the pane when the words are short, after them when they run on */}
          <PaneOptions atFoot>
            <PaneOption label="close" onClick={onClose} />
          </PaneOptions>
        </>
      )}
    </GlassPane>
  );
}
