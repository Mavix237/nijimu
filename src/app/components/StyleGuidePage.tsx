import { useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { CHROME_GRAY, COLOR_PALETTE, PANE_INK } from "../lib/colors";
import { PAGE_BG } from "./PuddleBackdrop";
import {
  BODY_SIZE, BUTTON_SIZE_SM, FLOW_PAGE, INSTRUCTION_SIZE, LABEL_SIZE, META, NAMING_PROSE_SIZE, TEXT_ENTER_MS,
  NOTE_SIZE, PROSE_SIZE, SANS, SANS_UI, SERIF, SERIF_CJK, SERIF_DISPLAY, SERIF_EXPOSURE,
  SERIF_ITALIC_TRACKING, TITLE, TITLE_SIZE, TRANSCRIPT,
} from "../lib/theme";
import { CAPTION_TITLE_GAP, CAPTION_TITLE_STYLE, CAPTION_YEAR_STYLE } from "./PuddleDiveGallery";
import { PAGE_HEADER_MARK, PageHeader } from "./PageHeader";
import { PillButton } from "./PillButton";
import { TextButton } from "./TextButton";
import { SpectrumSlider } from "./SpectrumSlider";
import { BackButton } from "./BackButton";

const TRAIL_INK = "#c4c4c9";
const TRANSCRIPT_INK = "#a4a4ab";
const TIMELINE_INK = "#4a4a4a";

const SECTION: CSSProperties = { display: "flex", flexDirection: "column", gap: 28 };
const CAPTION: CSSProperties = { ...META, margin: "0 0 10px" };

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 style={{
      fontFamily: SERIF, fontSize: NOTE_SIZE, fontWeight: 400, color: META.color,
      letterSpacing: "0.04em", textTransform: "lowercase", margin: 0,
    }}>
      {children}
    </h2>
  );
}

function Specimen({
  name, note, children, ground,
}: {
  name: string;
  note?: string;
  children: ReactNode;
  ground?: string;
}) {
  return (
    <div>
      <p style={CAPTION}>{name}{note ? ` — ${note}` : ""}</p>
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16,
        padding: ground ? "28px 24px" : 0, background: ground, borderRadius: ground ? 20 : 0,
      }}>
        {children}
      </div>
    </div>
  );
}

function Swatch({ hex, name }: { hex: string; name: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 88 }}>
      <div style={{ height: 56, borderRadius: 12, background: hex, boxShadow: "inset 0 0 0 1px rgba(80,80,86,0.08)" }} />
      <span style={{ fontFamily: SANS, fontSize: NOTE_SIZE, color: CHROME_GRAY, lineHeight: 1.35 }}>
        {name}
        <br />
        <span style={{ opacity: 0.65 }}>{hex}</span>
      </span>
    </div>
  );
}

function Token({ name, value }: { name: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(10em, 1fr) 2fr", gap: 12, alignItems: "baseline" }}>
      <span style={{ ...META, textTransform: "none", letterSpacing: "0.02em" }}>{name}</span>
      <span style={{ fontFamily: SERIF, fontSize: NOTE_SIZE, color: CHROME_GRAY, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

const StopIcon = ({ fill }: { fill: string }) => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
    <rect x="4" y="4" width="12" height="12" rx="2" fill={fill} />
  </svg>
);

function PlusMark() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" aria-hidden
      style={{ display: "inline-block", verticalAlign: "-0.15em", margin: "0 0.12em" }}>
      <rect x="1.5" y="1.5" width="13" height="13" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 4.75V11.25M4.75 8H11.25" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function StyleGuidePage() {
  const navigate = useNavigate();
  const noop = () => {};
  const [shape, setShape] = useState(0.42);
  const [rhythm, setRhythm] = useState(0.35);
  const [distance, setDistance] = useState(0.2);

  return (
    <div style={{ minHeight: "100dvh", background: PAGE_BG, padding: "0 28px 80px" }}>
      <BackButton onClick={() => navigate("/")} />
      <PageHeader link={false} />

      <main style={{ maxWidth: 720, margin: "0 auto" }}>
        <p style={{
          fontFamily: SERIF, fontSize: BODY_SIZE, color: CHROME_GRAY,
          margin: "0 0 16px", textTransform: "lowercase",
        }}>
          design system
        </p>
        <p style={{
          fontFamily: SERIF, fontSize: BODY_SIZE, color: PANE_INK.secondary,
          margin: "0 0 56px", lineHeight: 1.55, maxWidth: "42em",
        }}>
          quiet, contemplative, lowercase. serif first. no bright accents,
          no exclamation marks, no dense chrome. tokens live in
          <span style={{ fontFamily: SANS }}> lib/colors.ts</span> and
          <span style={{ fontFamily: SANS }}> lib/theme.ts</span> —
          this page is the specimen, not a second source.
        </p>

        <section style={{ ...SECTION, marginBottom: 72 }}>
          <Heading>color — primitive</Heading>
          <Specimen name="ground">
            <Swatch hex={PAGE_BG} name="page" />
            <Swatch hex="#f7f7f8" name="playhead" />
            <Swatch hex="#1c1c1e" name="dark field" />
          </Specimen>
          <Specimen name="chrome">
            <Swatch hex={CHROME_GRAY} name="chrome" />
            <Swatch hex={META.color} name="meta" />
            <Swatch hex={TRANSCRIPT_INK} name="caption words" />
            <Swatch hex={TRAIL_INK} name="trail" />
            <Swatch hex={TIMELINE_INK} name="timescale" />
          </Specimen>
          <Specimen name="pane ink" note="PANE_INK">
            <Swatch hex={PANE_INK.title} name="title" />
            <Swatch hex={PANE_INK.body} name="body" />
            <Swatch hex={PANE_INK.primary} name="primary" />
            <Swatch hex={PANE_INK.secondary} name="secondary" />
            <Swatch hex={PANE_INK.ring} name="ring" />
          </Specimen>
          <Specimen name="memory palette" note="COLOR_PALETTE">
            {COLOR_PALETTE.map((c) => (
              <Swatch key={c.id} hex={c.color} name={c.id} />
            ))}
          </Specimen>
        </section>

        <section style={{ ...SECTION, marginBottom: 72 }}>
          <Heading>color — semantic</Heading>
          <Token name="page.ground" value="PAGE_BG — landing, gallery, this guide" />
          <Token name="ink.chrome" value="CHROME_GRAY — wordmark, icons, instructions" />
          <Token name="ink.pane.title" value="PANE_INK.title — dialog headings" />
          <Token name="ink.pane.body" value="PANE_INK.body — dialog copy, slider knob rest" />
          <Token name="ink.pane.primary" value="PANE_INK.primary — the option the pane hopes for" />
          <Token name="ink.pane.secondary" value="PANE_INK.secondary — the way out" />
          <Token name="ink.gallery.words" value="#a4a4ab — transcript under the year" />
          <Token name="ink.gallery.trail" value="#c4c4c9 — words that follow the pointer" />
          <Token name="ink.gallery.rule" value="#4a4a4a — timescale ticks and playhead stroke" />
        </section>

        <section style={{ ...SECTION, marginBottom: 72 }}>
          <Heading>type</Heading>

          <Specimen name="wordmark" note="SERIF_CJK, 12">
            <span style={{
              fontFamily: SERIF_CJK, fontSize: PAGE_HEADER_MARK.fontSize,
              letterSpacing: PAGE_HEADER_MARK.letterSpacing, lineHeight: 1.5,
              color: CHROME_GRAY, textTransform: "lowercase",
              display: "flex", alignItems: "center", gap: PAGE_HEADER_MARK.gap,
            }}>
              <span>滲む</span>
              <span>nijimu</span>
            </span>
          </Specimen>

          <Specimen name="title" note={`TITLE, Exposure Trial, ${TITLE_SIZE}`}>
            <span style={{ ...TITLE, color: PANE_INK.title }}>before you begin</span>
          </Specimen>

          <Specimen name="instruction" note={`INSTRUCTION_SIZE, Rowan`}>
            <p style={{
              margin: 0, width: "100%", textAlign: "center", fontFamily: SERIF,
              fontWeight: 400, fontSynthesis: "none", fontSize: INSTRUCTION_SIZE,
              lineHeight: 1.45, color: CHROME_GRAY,
            }}>
              each memory already has a shape.
              <br />
              open your hands, and let these words find theirs.
            </p>
          </Specimen>

          <Specimen name="body" note={`BODY_SIZE, Rowan`}>
            <p style={{ margin: 0, fontFamily: SERIF, fontSize: BODY_SIZE, lineHeight: 1.5, color: CHROME_GRAY }}>
              some memories are never spoken.
            </p>
          </Specimen>

          <Specimen name="gallery hint" note="body, plus mark, 3.5s late, slow blink">
            <p style={{
              margin: 0, fontFamily: SERIF, fontSize: BODY_SIZE, lineHeight: 1.5,
              color: CHROME_GRAY,
            }}>
              keep scrolling or click <PlusMark /> to leave a memory of your own
            </p>
          </Specimen>

          <Specimen name="caption" note="italic Rowan + year">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              <p style={{ ...CAPTION_TITLE_STYLE, marginBottom: CAPTION_TITLE_GAP }}>the year everything slowed down</p>
              <p style={CAPTION_YEAR_STYLE}>2020</p>
              <p style={{
                color: TRANSCRIPT_INK, margin: "1.6em 0 0", maxWidth: "60ch",
                fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(12px, 0.9vw, 14px)",
                lineHeight: 1.6, textAlign: "center",
              }}>
                That year, the days stopped having edges. What I remember is the window:
                every day I watched the rectangle of light move over the rug.
              </p>
            </div>
          </Specimen>

          <Specimen name="trail" note="same face as the caption words, lighter">
            <span style={{
              fontFamily: SERIF, fontSize: "clamp(12px, 0.9vw, 14px)", fontWeight: 400,
              color: TRAIL_INK,
            }}>
              rectangle
            </span>
          </Specimen>

          <Specimen name="spoken" note={`TRANSCRIPT, Exposure Trial Plus, ${PROSE_SIZE}`}>
            <p style={{ ...TRANSCRIPT, margin: 0, color: CHROME_GRAY, maxWidth: "36em" }}>
              I keep coming back to that summer. Not to him, exactly — but to who I was when I was around him.
            </p>
          </Specimen>

          <Specimen name="naming prose" note={`NAMING_PROSE_SIZE, four-fifths of the pond`}>
            <span style={{ fontFamily: SERIF_DISPLAY, fontSize: NAMING_PROSE_SIZE, color: CHROME_GRAY }}>
              the light on a wall
            </span>
          </Specimen>

          <Specimen name="hint" note="NOTE_SIZE, Rowan">
            <span style={{ fontFamily: SERIF, fontSize: NOTE_SIZE, lineHeight: 1.45, color: CHROME_GRAY }}>
              transcribing...
            </span>
          </Specimen>

          <Specimen name="aside" note="NOTE_SIZE, Switzer">
            <span style={{ fontFamily: SANS, fontSize: NOTE_SIZE, color: CHROME_GRAY, opacity: 0.7 }}>
              drag across to grow it
            </span>
          </Specimen>

          <Specimen name="meta" note={`uppercase META, ${LABEL_SIZE}`}>
            <span style={META}>Member Since</span>
          </Specimen>

          <Specimen name="button label" note="BUTTON_SIZE_SM">
            <span style={{
              fontFamily: SANS, fontSize: BUTTON_SIZE_SM, fontWeight: 400,
              lineHeight: 1.5, color: "#7b7b87", textTransform: "lowercase",
            }}>
              continue
            </span>
            <span style={{
              fontFamily: SANS_UI, fontSize: BUTTON_SIZE_SM, fontWeight: 300,
              lineHeight: 1.5, color: "#7b7b87", textTransform: "lowercase",
            }}>
              record
            </span>
          </Specimen>

          <Specimen name="italic tracking" note={`SERIF_ITALIC_TRACKING ${SERIF_ITALIC_TRACKING}`}>
            <span style={{
              fontFamily: SERIF, fontStyle: "italic", letterSpacing: SERIF_ITALIC_TRACKING,
              fontSize: BODY_SIZE, color: CHROME_GRAY,
            }}>
              the light on a wall
            </span>
          </Specimen>
        </section>

        <section style={{ ...SECTION, marginBottom: 72 }}>
          <Heading>buttons</Heading>

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
          </Specimen>

          <Specimen name="dark primary" note="PillButton dark" ground="#1c1c1e">
            <PillButton label="record" onClick={noop} variant="dark" />
            <PillButton label="stop" onClick={noop} variant="dark" icon={<StopIcon fill="white" />} />
          </Specimen>

          <Specimen name="primary with icon">
            <PillButton label="stop" onClick={noop} icon={<StopIcon fill={CHROME_GRAY} />} />
          </Specimen>

          <Specimen name="create flow" note="recording and the sample story share this pair">
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <TextButton label="record again" onClick={noop} style={{ width: "9em", justifyContent: "center" }} />
              <span aria-hidden style={{ width: 1, height: "1em", background: "rgba(123, 123, 135, 0.45)" }} />
              <TextButton label="continue" onClick={noop} style={{ width: "9em", justifyContent: "center" }} />
            </div>
          </Specimen>

          <p style={{ margin: 0, fontFamily: SERIF, fontSize: BODY_SIZE, color: PANE_INK.secondary, lineHeight: 1.55 }}>
            The pond actions are text-only now — same seat, same pair. Bare Switzer
            can disappear on pale water. Studies below keep the type, no pill.
            Nothing here is the default yet.
          </p>

          <Specimen name="study A" note="heavier — 500">
            <TextButton label="continue" onClick={noop} style={{ fontWeight: 500 }} />
          </Specimen>

          <Specimen name="study B" note="16px, still Switzer">
            <TextButton label="continue" onClick={noop} style={{ fontSize: 16 }} />
          </Specimen>

          <Specimen name="study C" note="Rowan, the page's voice">
            <TextButton label="continue" onClick={noop} style={{ fontFamily: SERIF }} />
          </Specimen>

          <Specimen name="study D" note="hairline under the word">
            <TextButton label="continue" onClick={noop} style={{
              paddingBottom: 3,
              boxShadow: "inset 0 -1px 0 rgba(123, 123, 135, 0.45)",
            }} />
          </Specimen>

          <Specimen name="study E" note="the continue mark, no capsule">
            <TextButton label="continue" onClick={noop} trailing="›" />
          </Specimen>

          <Specimen name="study F" note="darker ink, PANE_INK.primary">
            <TextButton label="continue" onClick={noop} style={{ color: PANE_INK.primary }} />
          </Specimen>

          <Specimen name="chrome" note="back / plus">
            <button type="button" aria-label="back" onClick={noop} style={{
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none", cursor: "pointer", padding: 0, opacity: 0.6,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={CHROME_GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <PlusMark />
          </Specimen>
        </section>

        <section style={{ ...SECTION, marginBottom: 72 }}>
          <Heading>panes</Heading>
          <p style={{ margin: 0, fontFamily: SERIF, fontSize: BODY_SIZE, color: PANE_INK.secondary, lineHeight: 1.5 }}>
            GlassPane: squircle 12 / 0.6, grain, tint at ~70% of the old wash.
            Title 16px Exposure in PANE_INK.title. Rowan body in PANE_INK.body.
          </p>
          <div style={{
            maxWidth: 420, padding: "28px 32px 32px", borderRadius: 12,
            background: "rgba(240, 240, 238, 0.42)", boxShadow: "0 18px 48px rgba(70,70,78,0.08)",
          }}>
            <p style={{ ...TITLE, fontSize: 16, color: PANE_INK.title, margin: "0 0 12px" }}>To hear your voice</p>
            <p style={{ fontFamily: SERIF, fontSize: BODY_SIZE, color: PANE_INK.body, lineHeight: 1.55, margin: "0 0 22px" }}>
              If you’d like to speak a memory, please allow microphone access in your browser.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontFamily: SERIF, fontSize: BODY_SIZE, color: PANE_INK.primary }}>Allow microphone & record my story</span>
              <span style={{ fontFamily: SERIF, fontSize: BODY_SIZE, color: PANE_INK.secondary }}>Skip to a sample story</span>
            </div>
          </div>
        </section>

        <section style={{ ...SECTION, marginBottom: 72 }}>
          <Heading>controls</Heading>
          <Specimen name="spectrum" note="shape / rhythm / distance">
            <div style={{ display: "flex", flexDirection: "column", gap: 22, width: "100%" }}>
              <SpectrumSlider value={shape} onChange={setShape} from="circle" to="flower" label="memory shape" valueText={`${Math.round(shape * 100)}% shaped`} />
              <SpectrumSlider value={rhythm} onChange={setRhythm} from="petals" to="bloom" label="shape rhythm" valueText="folds" />
              <SpectrumSlider value={distance} onChange={setDistance} from="circle" to="haze" label="memory distance" valueText={`${Math.round(distance * 100)}% distant`} />
            </div>
          </Specimen>
          <p style={{ margin: 0, fontFamily: SERIF, fontSize: NOTE_SIZE, color: PANE_INK.secondary, lineHeight: 1.5 }}>
            knob rests as a short rounded bar in PANE_INK.secondary; held, it is a lighter rectangle in PANE_INK.body.
            the row stays one height on every step.
          </p>
        </section>

        <section style={{ ...SECTION, marginBottom: 72 }}>
          <Heading>motion</Heading>
          <Token name="copy.enter" value={`${TEXT_ENTER_MS}ms fade + 4px blur, no rise`} />
          <Token name="hint.enter" value="3.5s after the rim rests, then 700ms fade + blur" />
          <Token name="hint.breathe" value="3.6s, opacity 1 ↔ 0.566" />
          <Token name="trail.stagger" value="140ms after the pointer sets a word down" />
          <Token name="timescale.magnet" value="34px pull, playhead pulse 720ms on settle" />
          <Token name="pane.leave" value="LANDING_RETURN.profileLeaveMs" />
        </section>

        <section style={SECTION}>
          <Heading>layout</Heading>
          <Token name="flow.headingTop" value={String(FLOW_PAGE.headingTop)} />
          <Token name="flow.headingWidth" value={String(FLOW_PAGE.headingWidth)} />
          <Token name="flow.actionBottom" value={String(FLOW_PAGE.actionBottom)} />
          <Token name="flow.namingRaise" value={String(FLOW_PAGE.namingArtifactRaise)} />
          <Token name="compact" value="max-width 600px — chrome packs in, burger menu" />
          <Token name="caption" value="60ch, under title and year, only over the vessel" />
        </section>
      </main>
    </div>
  );
}
