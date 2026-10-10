import { CSSProperties, ReactNode } from "react";
import { CHROME_GRAY } from "../lib/colors";
import { PAGE_BG } from "./PuddleBackdrop";
import { BODY_SIZE, BUTTON_SIZE_SM, INSTRUCTION_SIZE, META, NOTE_SIZE, SANS, SANS_UI, SERIF, SERIF_CJK, TITLE, TRANSCRIPT, TRANSCRIPT_HIGHLIGHT } from "../lib/theme";
import { CAPTION_TITLE_GAP, CAPTION_TITLE_STYLE, CAPTION_YEAR_STYLE } from "./PuddleDiveGallery";
import { PAGE_HEADER_MARK, PageHeader } from "./PageHeader";
import { PillButton } from "./PillButton";
import { TextButton } from "./TextButton";

const SECTION: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 28,
};

const CAPTION: CSSProperties = {
  ...META,
  margin: "0 0 10px",
};

function Specimen({
  name,
  note,
  children,
  ground,
}: {
  name: string;
  note?: string;
  children: ReactNode;
  ground?: string;
}) {
  return (
    <div>
      <p style={CAPTION}>
        {name}
        {note ? ` — ${note}` : ""}
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 16,
          padding: ground ? "28px 24px" : 0,
          background: ground,
          borderRadius: ground ? 20 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** The highlight step's wash, inset the way the prompt draws it. */
function Marked({ children }: { children: ReactNode }) {
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 2,
          bottom: 2,
          background: TRANSCRIPT_HIGHLIGHT,
          zIndex: 0,
        }}
      />
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
}

/** A short run of the pond transcript, one phrase lifted the way a drag does. */
function TranscriptSample() {
  const words = "I keep coming back to that summer. Not to him, exactly — but to who I was when I was around him.".split(/\s+/);
  const lifted = new Set([5, 6]);

  return (
    <p
      style={{
        ...TRANSCRIPT,
        width: "100%",
        margin: 0,
        color: CHROME_GRAY,
        textAlign: "center",
      }}
    >
      {words.map((word, index) => (
        <span
          key={index}
          style={{
            position: "relative",
            display: "inline-block",
            marginRight: index < words.length - 1 ? "0.3em" : 0,
          }}
        >
          {lifted.has(index) && (
            <span
              style={{
                position: "absolute",
                left: -2,
                right: -2,
                top: 2,
                bottom: 2,
                background: TRANSCRIPT_HIGHLIGHT,
                zIndex: 0,
              }}
            />
          )}
          <span style={{ position: "relative", zIndex: 1 }}>{word}</span>
        </span>
      ))}
    </p>
  );
}

const StopIcon = ({ fill }: { fill: string }) => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
    <rect x="4" y="4" width="12" height="12" rx="2" fill={fill} />
  </svg>
);

export function StyleGuidePage() {
  const noop = () => {};

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: PAGE_BG,
        padding: "0 28px 80px",
      }}
    >
      <PageHeader link={false} />

      <main
        style={{
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        <p
          style={{
            fontFamily: SERIF,
            fontSize: BODY_SIZE,
            color: CHROME_GRAY,
            margin: "0 0 48px",
            textTransform: "lowercase",
          }}
        >
          buttons and type
        </p>

        <section style={{ ...SECTION, marginBottom: 72 }}>
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: NOTE_SIZE,
              fontWeight: 400,
              color: META.color,
              letterSpacing: "0.04em",
              textTransform: "lowercase",
              margin: 0,
            }}
          >
            buttons
          </h2>

          <Specimen name="primary" note="PillButton light">
            <PillButton label="continue" onClick={noop} />
            <PillButton label="continue" onClick={noop} trailing="›" />
            <PillButton label="record" onClick={noop} />
          </Specimen>

          <Specimen name="primary, sentence case" note="instruction dialogs">
            <PillButton label="Allow microphone & record" onClick={noop} transform="none" />
          </Specimen>

          <Specimen name="primary disabled">
            <PillButton label="continue" onClick={noop} disabled trailing="›" />
          </Specimen>

          <Specimen name="secondary" note="PillButton outline">
            <PillButton label="show sample transcript" onClick={noop} variant="outline" />
            <PillButton label="record again" onClick={noop} variant="outline" />
            <PillButton label="exit to landing page" onClick={noop} variant="outline" />
          </Specimen>

          <Specimen name="secondary disabled">
            <PillButton label="show sample transcript" onClick={noop} variant="outline" disabled />
          </Specimen>

          <Specimen name="dark primary" note="PillButton dark" ground="#1c1c1e">
            <PillButton label="record" onClick={noop} variant="dark" />
            <PillButton
              label="stop"
              onClick={noop}
              variant="dark"
              icon={<StopIcon fill="white" />}
            />
          </Specimen>

          <Specimen name="primary with icon">
            <PillButton
              label="stop"
              onClick={noop}
              icon={<StopIcon fill={CHROME_GRAY} />}
            />
          </Specimen>

          <Specimen name="text only" note="TextButton / Switzer">
            <TextButton label="save memory" onClick={noop} />
            <TextButton label="see it among the others" onClick={noop} />
            <TextButton label="Skip to sample transcript" onClick={noop} trailing="››" />
            <TextButton label="save memory" onClick={noop} disabled />
          </Specimen>

          <Specimen name="icon" note="back / chrome">
            <button
              type="button"
              aria-label="back"
              onClick={noop}
              style={{
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                opacity: 0.6,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7b7b87" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="profile"
              onClick={noop}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CHROME_GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
          </Specimen>
        </section>

        <section style={SECTION}>
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: NOTE_SIZE,
              fontWeight: 400,
              color: META.color,
              letterSpacing: "0.04em",
              textTransform: "lowercase",
              margin: 0,
            }}
          >
            type
          </h2>

          <Specimen name="wordmark" note="PageHeader">
            <span
              style={{
                fontFamily: SERIF_CJK,
                fontSize: PAGE_HEADER_MARK.fontSize,
                letterSpacing: PAGE_HEADER_MARK.letterSpacing,
                lineHeight: 1.5,
                color: CHROME_GRAY,
                textTransform: "lowercase",
                display: "flex",
                alignItems: "center",
                gap: PAGE_HEADER_MARK.gap,
              }}
            >
              <span>滲む</span>
              <span>nijimu</span>
            </span>
          </Specimen>

          <Specimen name="title" note="TITLE, Exposure Trial">
            <span style={{ ...TITLE, color: CHROME_GRAY }}>
              What's been lingering on your mind?
            </span>
          </Specimen>

          <Specimen name="caption" note="memory name and year">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              <p style={{ ...CAPTION_TITLE_STYLE, marginBottom: CAPTION_TITLE_GAP }}>the light on a wall</p>
              <p style={CAPTION_YEAR_STYLE}>2003</p>
            </div>
          </Specimen>

          <Specimen name="instruction" note="INSTRUCTION_SIZE">
            <p
              style={{
                margin: 0,
                width: "100%",
                textAlign: "center",
                fontFamily: SERIF,
                fontWeight: 400,
                fontSynthesis: "none",
                fontSize: INSTRUCTION_SIZE,
                lineHeight: 1.45,
                color: CHROME_GRAY,
              }}
            >
              each memory already has a shape.
              <br />
              open your hands, and let these words find theirs.
            </p>
          </Specimen>

          <Specimen name="highlight" note="BODY_SIZE">
            <div
              style={{
                width: "100%",
                textAlign: "center",
                fontFamily: SERIF,
                fontSize: BODY_SIZE,
                lineHeight: 1.5,
                color: CHROME_GRAY,
                textTransform: "lowercase",
              }}
            >
              <p style={{ margin: 0 }}>
                drag to <Marked>highlight</Marked> the words
              </p>
              <p style={{ margin: 0 }}>that touch you the most.</p>
            </div>
          </Specimen>

          <Specimen name="transcript" note="TRANSCRIPT, Exposure Trial Plus">
            <TranscriptSample />
          </Specimen>

          <Specimen name="hint" note="NOTE_SIZE">
            <span
              style={{
                fontFamily: SERIF,
                fontSize: NOTE_SIZE,
                lineHeight: 1.45,
                color: CHROME_GRAY,
              }}
            >
              transcribing...
            </span>
          </Specimen>

          <Specimen name="aside" note="NOTE_SIZE, Switzer">
            <span
              style={{
                fontFamily: SANS,
                fontSize: NOTE_SIZE,
                color: CHROME_GRAY,
                opacity: 0.7,
              }}
            >
              drag across to grow it
            </span>
          </Specimen>

          <Specimen name="field" note="slider / control">
            <span
              style={{
                fontFamily: SANS,
                fontSize: NOTE_SIZE,
                color: CHROME_GRAY,
                textTransform: "lowercase",
              }}
            >
              warmth
            </span>
          </Specimen>

          <Specimen name="field value">
            <span
              style={{
                fontFamily: SANS,
                fontSize: NOTE_SIZE,
                color: CHROME_GRAY,
              }}
            >
              42%
            </span>
          </Specimen>

          <Specimen name="meta" note="uppercase META">
            <span style={META}>Member Since</span>
          </Specimen>

          <Specimen name="button label" note="BUTTON_SIZE_SM">
            <span
              style={{
                fontFamily: SANS,
                fontSize: BUTTON_SIZE_SM,
                fontWeight: 400,
                lineHeight: 1.5,
                letterSpacing: 0,
                color: "#7b7b87",
                textTransform: "lowercase",
              }}
            >
              continue
            </span>
            <span
              style={{
                fontFamily: SANS_UI,
                fontSize: BUTTON_SIZE_SM,
                fontWeight: 300,
                lineHeight: 1.5,
                letterSpacing: 0,
                color: "#7b7b87",
                textTransform: "lowercase",
              }}
            >
              record
            </span>
          </Specimen>
        </section>
      </main>
    </div>
  );
}
