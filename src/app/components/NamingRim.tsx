import { resumeColorState } from "../lib/namingDraft";
import { useNavigate } from "react-router";
import {
  CSSProperties,
  KeyboardEvent,
  ReactNode,
  Ref,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildArchive, insertChronologically, type ArchiveArtifact } from "../lib/archive";
import { CHROME_GRAY, COLOR_PALETTE } from "../lib/colors";
import { saveMemory, type MemoryLook } from "../lib/memoryStore";
import { draftColorIndex, draftShapeOf } from "../lib/namingDraft";
export { draftColorIndex, draftShapeOf, draftAsSaved } from "../lib/namingDraft";
import type { MemoryAssignment } from "../lib/memoryShape";
import { CAROUSEL_PATH, DESCENT_STEP_PATHS } from "../lib/routes";
import {
  formKey,
  getArtifactMesh,
  type ArtifactForm,
} from "../lib/superformula";
import { SERIF } from "../lib/theme";
import { TextButton } from "./TextButton";
import { SaveMemoryDialog } from "./SaveMemoryDialog";
import {
  CAPTION_TITLE_GAP,
  CAPTION_TITLE_STYLE,
  CAPTION_YEAR_STYLE,
  PuddleDiveGallery,
  type DiveGalleryItem,
  type DivePhase,
  type DiveArrival,
} from "./PuddleDiveGallery";

/*
 * NamingRim — the naming step of the create flow, as a rim.
 *
 * The memory being made hangs at the apex of the same dome the home gallery
 * uses; a title and a year are typed into the caption beneath it. The step is
 * built as a hook + host rather than a page so that the homescreen can render
 * it *inside* its own scene: saving then only changes props on the gallery
 * that is already on screen, and the artifacts — WebGL canvases each — are
 * never torn down and rebuilt. Nothing that was already there moves; only the
 * water, the timescale and the arrows arrive.
 *
 * NameMemoryPage still exists as a standalone fallback for homescreens that
 * don't have the dive gallery.
 */

/** What the shape steps hand to the naming step in location.state. */
export interface NameFlowState {
  memoryId?: string;
  transcript?: string;
  highlightedWords?: string[];
  /** The reading that chose the form, kept with the memory when it is named. */
  assignment?: MemoryAssignment;
  matPresetIndex?: number;
  /** The glass tint the feeling step settled on — shown until the memory is saved. */
  matColor?: string;
  /** The photo, the pick and the frost, when the descent hands them on. */
  look?: MemoryLook;
  shape?: {
    form?: ArtifactForm;
    fluidity?: number;
    evolve?: number;
    bumpAmount?: number;
  };
  /** Set by the shape scene: the eye is still under the water and comes up to this step. */
  rise?: boolean;
}

/** What a host may take over from the rim: leaving, and what follows a save. */
export interface NamingRimHandlers {
  /** Current flow places the save action in its shared bottom row. */
  actionsInGrid?: boolean;
  /** Back to the previous step. Defaults to the feeling step with the state as it came. */
  onExit?: (state: NameFlowState) => void;
  /** After the memory is in the store. Defaults to opening the gallery on it. */
  onSaved?: (draftId: string) => void;
}

/** One visit to the naming step. The id is the memory's final id from the
    start, so the slot it holds on the rim is the slot it keeps once saved. */
export interface NamingSession {
  draftId: string;
  state: NameFlowState;
}

const currentYear = new Date().getFullYear();

/** How long the save button takes to leave before the words settle. */
const SAVE_FADE_MS = 380;

function FlickerCaret({
  color = CHROME_GRAY,
  fontSize,
}: {
  color?: string;
  fontSize?: CSSProperties["fontSize"];
}) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: 1,
        height: "1em",
        fontSize,
        background: color,
        pointerEvents: "none",
        zIndex: 3,
        animation: "nijimu-caret 1.05s steps(1) infinite",
      }}
    />
  );
}

function CaptionField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  autoFocus,
  maxLength,
  inputMode,
  style,
  className,
  focused,
  inputRef,
  onFocus,
  onBlur,
  onKeyDown,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  ariaLabel: string;
  autoFocus?: boolean;
  maxLength?: number;
  inputMode?: "text" | "numeric";
  style: CSSProperties;
  className?: string;
  focused: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const empty = value.length === 0;
  const showCaret = focused && empty;
  const sizerRef = useRef<HTMLSpanElement>(null);
  const [fitWidth, setFitWidth] = useState(0);
  const sizerText = value || placeholder;

  useEffect(() => {
    const el = sizerRef.current;
    if (!el) return;
    setFitWidth(Math.ceil(el.getBoundingClientRect().width));
  }, [sizerText, style.fontSize, style.fontFamily, style.fontStyle, style.fontWeight]);

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "text",
        maxWidth: "100%",
        position: "relative",
        zIndex: 2,
        width: "fit-content",
        verticalAlign: "middle",
      }}
    >
      <span
        ref={sizerRef}
        aria-hidden
        style={{
          ...style,
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "pre",
          pointerEvents: "none",
        }}
      >
        {sizerText}
      </span>
      {showCaret && (
        <FlickerCaret
          color={String(style.color ?? CHROME_GRAY)}
          fontSize={style.fontSize}
        />
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={className}
        autoFocus={autoFocus}
        maxLength={maxLength}
        inputMode={inputMode}
        style={{
          ...style,
          width: fitWidth > 0 ? fitWidth : "auto",
          fieldSizing: "content",
          maxWidth: "min(70vw, var(--naming-field, 70vw))",
          background: "transparent",
          border: "none",
          outline: "none",
          padding: 0,
          verticalAlign: "middle",
          caretColor: showCaret ? "transparent" : focused ? style.color : "transparent",
        }}
      />
    </label>
  );
}

/** What the naming step needs the dome to show. */
export interface NamingRim {
  items: DiveGalleryItem[];
  activeIdx: number;
  caption: ReactNode;
  actions: ReactNode;
  /** The neighbours only gather once the memory has a year to stand in. */
  neighborsVisible: boolean;
  /** Back to the previous step. */
  exit: () => void;
}

/**
 * The naming step's state and its rim. Pass `null` when the step isn't active;
 * the hook then costs nothing and returns null, so a component can host either
 * the naming rim or the settled gallery without changing shape.
 */
export function useNamingRim(
  session: NamingSession | null,
  reducedMotion: boolean,
  handlers: NamingRimHandlers = {},
): NamingRim | null {
  const navigate = useNavigate();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const state = session?.state ?? null;
  const draftId = session?.draftId ?? "";
  const [memoryName, setMemoryName] = useState("");
  const [year, setYear] = useState("");
  const [yearHint, setYearHint] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<"name" | "year" | null>(null);
  const [fieldsVisible, setFieldsVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const yearInputRef = useRef<HTMLInputElement>(null);
  const [archive] = useState(() => (session ? buildArchive() : []));

  useEffect(() => {
    if (!yearHint) return;
    const t = window.setTimeout(() => setYearHint(null), 2600);
    return () => window.clearTimeout(t);
  }, [yearHint]);

  const matPresetIndex = state?.matPresetIndex ?? 0;
  const colorIndex = draftColorIndex(matPresetIndex);
  const draftYear = year.trim() || String(currentYear);
  const draftShape = useMemo(() => draftShapeOf(state), [state]);
  const active = session !== null;

  const draftFormKey = formKey(draftShape.form);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    // The form is generated, not fetched: build it now so the artifact has
    // its mesh on its first frame.
    getArtifactMesh(draftShape.form);

    const paint = () => {
      if (cancelled) return;
      setFieldsVisible(true);
      setFocusedField("name");
    };
    if (reducedMotion) {
      paint();
      return () => {
        cancelled = true;
      };
    }
    // Let the artifact paint first, then fade the fields in.
    const timer = window.setTimeout(() => requestAnimationFrame(paint), 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, draftFormKey, reducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  // A touch screen opens its keyboard on focus, over the vessel that has just
  // landed: there the name waits for a tap instead.
  const focusOnArrival = fieldsVisible && !window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  useEffect(() => {
    if (!focusOnArrival) return;
    nameInputRef.current?.focus();
    setFocusedField("name");
  }, [focusOnArrival]);

  const focusName = () => {
    nameInputRef.current?.focus();
    setFocusedField("name");
  };

  const focusYear = () => {
    yearInputRef.current?.focus();
    setFocusedField("year");
  };

  /** A year is only a year once all four digits are in and it has happened. */
  const yearSettled = year.length === 4 && Number(year) <= currentYear;

  /* The year the rim is struck from. It outlives an edit to the field, so
     clearing the year lets the neighbours sink back out from where they stand
     instead of re-shuffling around a half-typed one on their way down. */
  const [rimYear, setRimYear] = useState<string | null>(null);
  useEffect(() => {
    if (yearSettled) setRimYear(year);
  }, [year, yearSettled]);

  /* The rim, with the memory being made standing in it. Until there is a year
     it has no place in time, so it hangs alone; once the year settles it takes
     the seat it will keep in the archive and the memories on either side of it
     are the ones it will actually sit between. */
  const { items, activeIdx } = useMemo(() => {
    const draft: ArchiveArtifact = {
      id: draftId,
      year: rimYear ?? draftYear,
      event: memoryName,
      transcript: state?.transcript ?? "",
      highlightedWords: state?.highlightedWords ?? [],
      colorIndex,
      shape: draftShape,
      look: state?.look,
    };
    if (!rimYear) return { items: [draft], activeIdx: 0 };
    const placed = insertChronologically(archive, draft);
    return { items: placed.items, activeIdx: placed.index };
  }, [archive, colorIndex, draftId, draftShape, draftYear, memoryName, rimYear, state?.transcript, state?.highlightedWords, state?.look]);

  const canContinue = memoryName.trim() !== "" && yearSettled && !saving;

  const persistAndOpenGallery = () => {
    if (!canContinue) return;
    const shape = state?.shape;
    const stored = saveMemory({
      id: draftId,
      title: memoryName.trim(),
      year,
      transcript: state?.transcript ?? "",
      highlightedWords: state?.highlightedWords ?? [],
      shape: {
        form: draftShape.form,
        matPresetIndex,
        fluidity: shape?.fluidity ?? draftShape.fluidity,
        evolve: shape?.evolve ?? draftShape.evolve,
        bumpAmount: shape?.bumpAmount ?? draftShape.bumpAmount,
      },
      colorIndex,
      ...(state?.assignment ? { assignment: state.assignment } : {}),
      ...(state?.look ? { look: state.look } : {}),
      createdAt: new Date().toISOString(),
    });
    if (!stored) {
      setStorageError("Your browser couldn’t save this memory for the session. Storage may be full or disabled. You can still download an image to keep it.");
      return;
    }
    setStorageError(null);
    setSaveDialog(false);
    setSaving(true);

    const commit = () => {
      if (handlersRef.current.onSaved) {
        handlersRef.current.onSaved(draftId);
        return;
      }
      /* The gallery continues the rim that is already on screen: same memory at
         the apex, same neighbours, so only the water and the chrome arrive.
         The naming step is replaced in history: there is no draft to come back to. */
      navigate(CAROUSEL_PATH, {
        replace: true,
        state: { galleryOpen: true, galleryFocusId: draftId, galleryCarried: true },
      });
    };

    // the button leaves first, so the words are alone when they settle
    if (reducedMotion) commit();
    else window.setTimeout(commit, SAVE_FADE_MS);
  };

  const handleYearChange = (next: string) => {
    if (/\D/.test(next)) {
      setYearHint("use a four-digit year");
    }
    const digits = next.replace(/\D/g, "").slice(0, 4);
    if (digits.length === 4 && Number(digits) > currentYear) {
      setYearHint("that year hasn't happened yet");
      return;
    }
    if (!/\D/.test(next)) setYearHint(null);
    setYear(digits);
  };

  if (!session) return null;

  /* Same DOM shape as StaticCaption — a column, the title in a block with the
     shared gap below it, then the year — so when the fields become words
     nothing shifts. */
  const actions = fieldsVisible && memoryName.trim() !== "" && yearSettled && (
        <><TextButton
          label="save memory"
          onClick={() => setSaveDialog(true)}
          disabled={saving}
          style={{
            /* out of flow, so its coming and going never moves the words */
            ...(handlers.actionsInGrid ? {} : { position: "absolute" as const, top: "100%", marginTop: 56 }),
            opacity: saving ? 0 : 1,
            filter: saving ? "blur(4px)" : "none",
            transition: reducedMotion
              ? "none"
              : `opacity ${SAVE_FADE_MS}ms ease, filter ${SAVE_FADE_MS}ms ease`,
          }}
        />
        {saveDialog && <SaveMemoryDialog session={session} title={memoryName.trim()} year={year}
          storageError={storageError} onClose={() => setSaveDialog(false)} onContinue={persistAndOpenGallery} />}</>
      );

  const caption = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        zIndex: 2,
        opacity: fieldsVisible ? 1 : 0,
        transition: reducedMotion ? "none" : "opacity 0.9s ease",
        pointerEvents: fieldsVisible && !saving ? "auto" : "none",
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div style={{ marginBottom: CAPTION_TITLE_GAP }}>
        <CaptionField
          value={memoryName}
          onChange={setMemoryName}
          placeholder="name this memory..."
          ariaLabel="memory name"
          autoFocus={focusOnArrival}
          inputRef={nameInputRef}
          focused={fieldsVisible && focusedField === "name"}
          onFocus={() => setFocusedField("name")}
          onBlur={() => setFocusedField((current) => (current === "name" ? null : current))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (!memoryName.trim()) return;
              event.preventDefault();
              focusYear();
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              focusYear();
            }
          }}
          style={CAPTION_TITLE_STYLE}
        />
      </div>
      <CaptionField
        value={year}
        onChange={handleYearChange}
        placeholder="year"
        ariaLabel="year"
        maxLength={4}
        inputMode="numeric"
        className="nijimu-year-field"
        inputRef={yearInputRef}
        focused={fieldsVisible && focusedField === "year"}
        onFocus={() => setFocusedField("year")}
        onBlur={() => setFocusedField((current) => (current === "year" ? null : current))}
        onKeyDown={(event) => {
          if (event.key === "Enter" && canContinue) {
            event.preventDefault();
            setSaveDialog(true);
            return;
          }
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            focusName();
          }
        }}
        style={CAPTION_YEAR_STYLE}
      />
      {yearHint && (
        <p
          role="status"
          style={{
            position: "absolute",
            top: "100%",
            margin: "10px 0 0",
            padding: "6px 12px",
            fontFamily: SERIF,
            fontSize: 11,
            fontStyle: "italic",
            color: "#7b7b87",
            background: "rgba(255,255,255,0.82)",
            borderRadius: 8,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {yearHint}
        </p>
      )}
      {!handlers.actionsInGrid && actions}
      <style>{`
        @keyframes nijimu-caret {
          0%, 49% { opacity: 0.7; }
          50%, 100% { opacity: 0; }
        }
        input::placeholder {
          color: inherit;
          opacity: 0.35;
          font-style: inherit;
        }
        .nijimu-year-field::placeholder {
          color: ${CHROME_GRAY};
          opacity: 0.35;
        }
      `}</style>
    </div>
  );

  return {
    items,
    activeIdx,
    caption,
    actions,
    neighborsVisible: yearSettled,
    exit: () => {
      if (saving) return;
      const flow = state ?? {};
      if (handlersRef.current.onExit) handlersRef.current.onExit(flow);
      else navigate(DESCENT_STEP_PATHS.color, { state: resumeColorState(flow) });
    },
  };
}

/** The settled gallery's props, minus what the host supplies itself. */
export interface DiveGalleryProps {
  hideHeader?: boolean;
  pondDeparture?: number;
  inkArrival?: import("../lib/landingTransition").InkArrival;
  items: DiveGalleryItem[];
  activeIdx: number;
  phase: DivePhase;
  onNavigate: (delta: number) => void;
  onExit?: () => void;
  onOverscrollExit?: () => void;
  onToggleGrid?: () => void;
  toggleIcon?: "view" | "plus";
  arrival: DiveArrival;
}

/**
 * One PuddleDiveGallery, whichever step it is showing. While `naming` is set
 * it is the naming rim — editable caption, no water, no ruler, neighbours
 * gathering on the year. When `naming` goes away the same element becomes the
 * gallery: only its props change, so every artifact stays exactly where and
 * what it was, and `arrival: 'carried'` tells it so.
 */
export function DiveGalleryHost({
  naming,
  reducedMotion,
  gallery,
}: {
  naming: NamingSession | null;
  reducedMotion: boolean;
  gallery: DiveGalleryProps;
}) {
  const rim = useNamingRim(naming, reducedMotion);
  const handedFocusId = useRef<string | null>(null);
  if (rim) {
    handedFocusId.current = rim.items[rim.activeIdx]?.id ?? null;
    return (
      <PuddleDiveGallery
        items={rim.items}
        activeIdx={rim.activeIdx}
        phase="gallery"
        reducedMotion={reducedMotion}
        onNavigate={() => {}}
        onExit={rim.exit}
        exitOnBackdropClick={false}
        caption={rim.caption}
        showTimeScale={false}
        showArrows={false}
        waterEffect={false}
        neighborsVisible={rim.neighborsVisible}
      />
    );
  }
  let activeIdx = gallery.activeIdx;
  if (handedFocusId.current) {
    const i = gallery.items.findIndex((item) => item.id === handedFocusId.current);
    if (i >= 0) {
      activeIdx = i;
      if (gallery.activeIdx === i) handedFocusId.current = null;
    }
  }
  return <PuddleDiveGallery {...gallery} activeIdx={activeIdx} reducedMotion={reducedMotion} />;
}
