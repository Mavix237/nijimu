import { useState, type CSSProperties } from "react";
import { TextButton } from "../components/TextButton";
import { NOTE_SIZE } from "../lib/theme";

/**
 * Publishes the open side panel onto its page in the main flow.
 * Sits in a bottom corner. It reads as pushed until `mark` changes,
 * which is that panel, so the next edit asks to be pushed again.
 */
export function LabPushButton({
  mark,
  liveMark,
  onPush,
  label = "push",
  pushedLabel = "pushed",
  style,
}: {
  mark: string;
  /** The panel the main page is already drawing. Matching it reads as pushed. */
  liveMark?: string;
  onPush: () => void;
  label?: string;
  pushedLabel?: string;
  style?: CSSProperties;
}) {
  const [held, setHeld] = useState<string | null>(null);
  const pushed = held === mark || (liveMark != null && liveMark === mark);
  return (
    <TextButton
      label={pushed ? pushedLabel : label}
      onClick={() => {
        onPush();
        setHeld(mark);
      }}
      style={{
        position: "fixed",
        left: 22,
        bottom: 18,
        zIndex: 130000,
        fontSize: NOTE_SIZE,
        ...style,
      }}
    />
  );
}
