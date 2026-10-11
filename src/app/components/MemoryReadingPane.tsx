import { useState } from "react";
import { CHROME_GRAY } from "../lib/colors";
import { BODY_SIZE, NOTE_SIZE, SERIF, SERIF_CJK, SERIF_ITALIC_TRACKING, TITLE_SIZE } from "../lib/theme";
import { GlassPane } from "./GlassPane";
import { PillButton } from "./PillButton";

export interface ReadableMemory {
  id: string;
  event: string;
  year: string;
  transcript: string;
}

/**
 * A memory's whole text, on a phone: the gallery there shows only the name
 * and year under the vessel, and pressing the vessel opens this. The same
 * glass pane as the profile, at a reading height, scrolling inside;
 * the name and year set as the gallery's caption sets them, the words
 * centred, as the gallery lays them out.
 */
export function MemoryReadingPane({ memory, onClose }: { memory: ReadableMemory | null; onClose: () => void }) {
  // the last memory stays in the pane while it leaves
  const [shown, setShown] = useState<ReadableMemory | null>(memory);
  if (memory && memory !== shown) setShown(memory);
  const words = shown?.transcript.trim() ?? "";

  return (
    <GlassPane open={!!memory} onClose={onClose} onExited={() => setShown(null)} labelledBy="memory-reading-title" tall>
      {shown && (
        <>
          <header style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
            <h2
              id="memory-reading-title"
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: TITLE_SIZE,
                letterSpacing: SERIF_ITALIC_TRACKING,
                lineHeight: 1.3,
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
          </header>

          <div
            aria-hidden
            style={{
              width: "min(220px, 60%)",
              height: 1,
              flexShrink: 0,
              background: "linear-gradient(90deg, transparent, rgba(123, 123, 135, 0.25), transparent)",
            }}
          />

          <p
            lang="en"
            style={{
              margin: 0,
              width: "100%",
              maxWidth: "34em",
              fontFamily: SERIF,
              fontSize: BODY_SIZE,
              fontWeight: 400,
              lineHeight: 1.7,
              color: "#7b7b87",
              textAlign: "center",
              overflowWrap: "break-word",
              whiteSpace: "pre-line",
            }}
          >
            {words || "no words were kept with this memory."}
          </p>

          {/* at the foot of the pane when the words are short, after them when they run on */}
          <PillButton label="close" variant="outline" onClick={onClose} style={{ flexShrink: 0, marginTop: "auto" }} />
        </>
      )}
    </GlassPane>
  );
}
