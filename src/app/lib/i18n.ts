import { useSyncExternalStore } from "react";

/*
 * The interface in two languages: English and Simplified Chinese (set in the
 * site's CJK face, GenRyuMin2 TW, which carries the simplified characters too). One typed dictionary — `en` is the shape, `zh`
 * must give every key — and one choice per device (localStorage
 * `nijimu.lang`; `?lang=zh|en` sets it, as the phone's QR link does; with
 * neither, a first visit follows the browser's languages: browserLang). The
 * choice switches live: components read `useT()`; code outside render reads
 * `messages()` at the moment it needs a string.
 *
 * Only the interface is translated. A memory's own words stay as they were
 * told: the curated memories (names, years, transcripts in `data/`), the
 * landing's floating captions, the vessels' and cards' names, the 滲む nijimu
 * wordmark. English copy keeps its lowercase conventions; Chinese has none.
 *
 * New Chinese characters here need the `-zh` font subset rebuilt (README,
 * "Fonts"; `node scripts/zh-ui-chars.mjs`), or they fall to the full 2.2 MB font.
 */

export type Lang = "en" | "zh";

const KEY = "nijimu.lang";

const en = {
  // ── header ──
  langName: "中文",
  langAria: "阅读中文版 — read in chinese",
  musicName: "music",
  musicOn: "music on",
  musicOff: "music off",
  mute: "mute",
  unmute: "unmute",
  menu: "menu",
  closeMenu: "close menu",
  back: "back",
  createName: "create",
  createTitle: "create a new memory",
  createRow: "new memory",
  gridView: "grid view",
  gridName: "grid",
  galleryView: "gallery view",
  galleryName: "gallery",
  fieldToTimeline: "back along the years",
  fieldToAir: "see them in the air",
  timelineName: "timeline\nview",
  constellationName: "constellation\nview",
  timelineRow: "timeline view",
  constellationRow: "constellation view",

  // ── landing ──
  landingDesc: "An interactive memory sculpting tool to trace how memory evolves.",
  enter: "Enter",
  introLine1: "some memories are never spoken.",
  introLine2: "this is a place to let them settle.",

  // ── gallery ──
  memoryGallery: "memory gallery",
  olderMemory: "older memory",
  newerMemory: "newer memory",
  memoriesInTime: "memories in time",
  seeAsVessels: "see the memories as vessels",
  tipScrollEnd: "scroll once more to begin yours",
  tipSwipeEnd: "swipe once more to begin yours",
  /** before the plus mark */
  tipScrollMid: "keep scrolling or click",
  tipSwipeMid: "keep swiping or tap",
  /** after the plus mark, on its own line */
  tipMidTail: "to leave a memory of your own",
  editTipClick: "click on the transcript to edit",
  editTipTap: "tap on the transcript to edit",
  readingLabel: "the words of this memory",
  readingEmpty: "no words were kept with this memory.",
  close: "close",

  // ── pond ──
  pondHeading: "To create a new memory artifact, record yourself talking about a particular memory.",
  holdToBegin: "Hold to begin",
  holdHelp: "Hold for two seconds, or hold Space or Enter. Release to cancel.",
  pondNaming: "name your memory",
  pondRecording: "record a memory",
  pondPlain: "a pond for a new memory",
  readyToRecord: "ready to record",
  pondThoughts: [
    "When was the last time your heart felt heavy?",
    "Who made an ordinary day feel different?",
    "What is a small moment you wish you could return to?",
  ] as readonly string[],

  // ── recording ──
  speakAboutMemory: "Speak about a memory.",
  recordNote1: "Think of a memory in your mind, and talk about it freely.",
  recordNote2: "Stop when the story feels complete.",
  record: "record",
  recordAgain: "record again",
  sampleStory: "sample story",
  stop: "stop",
  recordingDuration: "recording duration",
  recordingTimer: (time: string, secondsLeft: number | null) =>
    `recording · ${time}${secondsLeft !== null ? ` · ${secondsLeft}s left` : ""}`,
  recordFailed: "The recording didn't come through — try again",
  micOff: "microphone access is off. allow it in your browser’s site settings, then try again—or explore with a sample memory.",
  micUnsupported: "This browser can't record — try chrome",
  micFailed: "The microphone couldn't be opened — try again",
  hearTitle: "To hear your voice",
  hearBody1: "If you’d like to speak about a memory, please allow microphone access in your browser.",
  hearBody2: "Or, skip to a sample story to experience the full flow without recording yourself.",
  openingMic: "Opening microphone…",
  allowMic: "Allow microphone & record my story",
  skipToSample: "Skip to a sample story",
  beginWith: (title: string) => `Begin with “${title}”`,

  // ── transcript ──
  transcriptLost: "The transcription was lost — try recording again.",
  transcriptFailed: "The transcription didn’t come through — try recording again.",
  /** an error under the words: English lowercases the reason after its dash */
  couldntHear: (reason: string) => `couldn't hear that — ${reason.toLowerCase()}`,
  transcriptBox: "your memory, in words",
  continue: "continue",

  // ── descent ──
  photoHeading: "click the film frame to upload a photo for this memory",
  choosePhotoForFilm: "choose a photo for the film",
  choosePhoto: "choose a photo",
  selectPhoto: "select photo",
  photoLibrary: "photo library",
  orOneOfThese: "or one of these",
  colorField: "color field",
  vesselHeading: "Begin building a vessel for your memory.",
  passThrough: "press and hold to pass through",
  findingForm: "finding your memory’s form…",
  findingFormWait: "finding the form of this memory… you can descend when it is ready.",
  stepShape: "shape",
  stepRhythm: "rhythm",
  stepDistance: "distance",
  stepColor: "color",
  shapeLine1: "Based on your words, this memory has been given a vessel.",
  shapeLine1Sample: "Based on the transcript, this memory has been given a vessel.",
  shapeLine2: "Bring your hands together, then slowly open them to reveal its shape.",
  rhythmLine1: "Does this memory stir complex feelings, like a jagged ballad, or soothe you like a steady hum?",
  rhythmLine2: "Pinch your thumb and index finger to compose its form and texture.",
  distanceLine1: "Is this a vivid memory that still feels close to you, or is it deeply buried in the back of your mind?",
  distanceLine2: "Push your open palm toward the camera to place it in your archive.",
  colorLine1: "What color does this memory feel like?",
  colorLine2: "Point at the screen to move through the spectrum.",
  dragAcross: (step: string) => `${step} — drag across`,
  shapeSlider: "memory shape",
  shapeValue: (pct: number) => `${pct}% shaped`,
  rhythmSlider: "shape rhythm",
  rhythmValue: (folds: number) => `${folds} folds`,
  distanceSlider: "memory distance",
  distanceValue: (pct: number) => `${pct}% distant`,
  followTip: "follow the animation with your hands",
  cameraOff: "turn the camera off",
  cameraOn: "turn the camera on",
  readThisAgain: "read this memory again",
  beginWithRecorded: "begin with a recorded memory",
  seeAmongOthers: "see it among the others",

  // ── camera dialog ──
  cameraTitle: "Enable camera access",
  cameraBody: "We use camera to access hand-tracking, which allows you to sculpt this memory by hand. Please allow camera access from your browser.",
  cameraError: "We couldn’t start hand tracking. Allow camera access in your browser’s site settings and try again, or continue with the mouse.",
  startingTracking: "Starting hand tracking…",
  tryCameraAgain: "Try camera again",
  allowCamera: "Allow camera & Begin",
  maybeLater: "Maybe later",

  // ── naming ──
  namePlaceholder: "name this memory...",
  nameAria: "memory name",
  yearPlaceholder: "year",
  yearAria: "year",
  yearDigits: "use a four-digit year",
  yearFuture: "that year hasn't happened yet",
  saveMemory: "save memory",
  beingMadeRead: "the memory being made — read its words",
  beingMade: "the memory being made",
  storageFailed: "Your browser couldn’t save this memory for the session. Storage may be full or disabled. You can still download an image to keep it.",

  // ── keep a copy ──
  keepTitle: "Keep a copy of your memory",
  keepBody1: "You’re exploring nijimu as a guest. Your memory will remain in the gallery during this visit, but won’t be saved or shared publicly.",
  keepBody2: "Download an image to take a piece of it with you.",
  preparingMemory: "Preparing your memory…",
  downloadImage: "Download as image",
  saveToPhone: "Save to your phone",
  continueWithoutDownload: "Continue without download",
  cardAria: (title: string, year: string) => `the memory's card: ${title}, ${year}`,
  imageUnprepared: "The image couldn’t be prepared. Please try again, or continue without downloading.",
  codeUndrawn: "The code couldn’t be drawn. Please try again.",
  imageUnpreparedShort: "The image couldn’t be prepared. Please try again.",
  phoneTitle: "Save it to your phone",
  phoneBody: "Scan the code with your phone’s camera to open and save your image. The following link will be valid for a day.",
  preparingCode: "Preparing the code…",
  qrAlt: (link: string) => `QR code for ${link}`,
  tryAgain: "Try again",
  done: "Done",
  backPane: "Back",
  phonePrepareFailed: "The image couldn’t be prepared for your phone.",
  phoneSendFailed: "The image couldn’t be sent. Please try again.",
  phoneOffline: "The image couldn’t be sent. Check your connection and try again.",
  phoneNotSetUp: "Saving to a phone isn’t set up here.",

  // ── the phone's page ──
  keepPageTitle: "nijimu — your memory",
  keepCardAlt: "your memory's card",
  saveToPhotos: "save to your photos",
  openingMemory: "opening your memory…",
  keepGone: "This image is no longer kept here. Memories saved to a phone are held for a day, then deleted.",
  keepFailed: "The image couldn’t be opened. Check your connection and scan the code again.",

  // ── profile ──
  profile: "profile",
  memberSince: "Member Since",
  memoriesArchived: "Memories Archived",
  memoriesCount: (n: number) => `${n} ${n === 1 ? "memory" : "memories"}`,
  monthYear: (year: number, month: number) =>
    `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month - 1]} ${year}`,
  exitToLanding: "exit to landing page",
};

export type Messages = typeof en;

const zh: Messages = {
  // ── header ──
  langName: "english",
  langAria: "switch to english — 切换为英文",
  musicName: "音乐",
  musicOn: "音乐 开启",
  musicOff: "音乐 关闭",
  mute: "静音",
  unmute: "取消静音",
  menu: "菜单",
  closeMenu: "关闭菜单",
  back: "返回",
  createName: "新建回忆",
  createTitle: "留下一段新的记忆",
  createRow: "新的记忆",
  gridView: "网格视图",
  gridName: "网格",
  galleryView: "画廊视图",
  galleryName: "画廊",
  fieldToTimeline: "沿着年岁回去",
  fieldToAir: "看它们悬在空中",
  timelineName: "时间\n视图",
  constellationName: "星群\n视图",
  timelineRow: "时间视图",
  constellationRow: "星群视图",

  // ── landing ──
  /** two lines of their own: the block is only as wide as the Enter row */
  landingDesc: "互动的记忆雕塑工具，\n追溯记忆如何流转。",
  enter: "进入",
  introLine1: "有些记忆，从未被说出口。",
  introLine2: "这里，让它们慢慢沉淀。",

  // ── gallery ──
  memoryGallery: "记忆画廊",
  olderMemory: "较早的记忆",
  newerMemory: "较新的记忆",
  memoriesInTime: "时间里的记忆",
  seeAsVessels: "把记忆看作器皿",
  tipScrollEnd: "再滚动一次，开始你的记忆",
  tipSwipeEnd: "再滑动一次，开始你的记忆",
  tipScrollMid: "继续滚动，或点击",
  tipSwipeMid: "继续滑动，或轻触",
  tipMidTail: "留下一段属于你的记忆",
  editTipClick: "点击文字，即可编辑",
  editTipTap: "轻触文字，即可编辑",
  readingLabel: "这段记忆的文字",
  readingEmpty: "这段记忆没有留下文字。",
  close: "关闭",

  // ── pond ──
  pondHeading: "若要创造一件新的记忆器物，请长按水池并讲述一段记忆。",
  holdToBegin: "长按以开始",
  holdHelp: "按住两秒，或按住空格键或回车键。松开即取消。",
  pondNaming: "为你的记忆命名",
  pondRecording: "录下一段记忆",
  pondPlain: "一方为新记忆而设的池水",
  readyToRecord: "可以开始录音",
  pondThoughts: [
    "上一次心里感到沉重，是什么时候？",
    "是谁，让平凡的一天变得不同？",
    "有哪个微小的片刻，你希望能再回去？",
  ],

  // ── recording ──
  speakAboutMemory: "说说一段记忆。",
  recordNote1: "在心里想起一段记忆，自在地说出来。",
  recordNote2: "当故事感觉完整了，就停下来。",
  record: "录音",
  recordAgain: "重新录音",
  sampleStory: "示例故事",
  stop: "停止",
  recordingDuration: "录音时长",
  recordingTimer: (time, secondsLeft) =>
    `录音中 · ${time}${secondsLeft !== null ? ` · 还剩 ${secondsLeft} 秒` : ""}`,
  recordFailed: "录音没有成功——请再试一次",
  micOff: "麦克风权限已关闭。请在浏览器的网站设置中允许使用，然后再试一次——或用示例记忆来探索。",
  micUnsupported: "这个浏览器无法录音——请试试 Chrome",
  micFailed: "无法打开麦克风——请再试一次",
  hearTitle: "聆听你的声音",
  hearBody1: "如果你想说说一段记忆，请在浏览器中允许使用麦克风。",
  hearBody2: "或者，直接跳到示例故事，不必录音也能体验完整的流程。",
  openingMic: "正在打开麦克风…",
  allowMic: "允许麦克风访问",
  skipToSample: "跳到示例文本",
  beginWith: (title) => `从“${title}”开始`,

  // ── transcript ──
  transcriptLost: "文字记录丢失了——请再录一次。",
  transcriptFailed: "没能转成文字——请再录一次。",
  couldntHear: (reason) => `没能听清楚——${reason}`,
  transcriptBox: "你的记忆，化为文字",
  continue: "继续",

  // ── descent ──
  photoHeading: "点击胶片的画框，把这段记忆放进一张照片",
  choosePhotoForFilm: "为胶片选一张照片",
  choosePhoto: "选择照片",
  selectPhoto: "选取这张照片",
  photoLibrary: "照片库",
  orOneOfThese: "或选这几张",
  colorField: "色域",
  vesselHeading: "开始为你的记忆创造一件容器。",
  passThrough: "长按以穿过水面",
  findingForm: "正在寻找你记忆的形状…",
  findingFormWait: "正在寻找这段记忆的形状……准备好后，即可潜入水中。",
  stepShape: "形状",
  stepRhythm: "韵律",
  stepDistance: "距离",
  stepColor: "色彩",
  shapeLine1: "依着你的话语，这段记忆有了一只器皿。",
  shapeLine1Sample: "依着这段文字，这段记忆有了一只器皿。",
  shapeLine2: "双手合拢，再慢慢张开，让它的形状显现。",
  rhythmLine1: "这段记忆搅起了复杂的心绪，像一首参差的歌谣；还是像一段平稳的低吟，让你安心？",
  rhythmLine2: "捏合拇指与食指，谱出它的形态与纹理。",
  distanceLine1: "这段记忆依然鲜明，仿佛近在身旁；还是早已深埋在心底？",
  distanceLine2: "张开手掌推向镜头，将它安放进你的记忆库。",
  colorLine1: "这段记忆，是什么颜色？",
  colorLine2: "指向屏幕，在色谱之间移动。",
  dragAcross: (step) => `${step}——左右拖动`,
  shapeSlider: "记忆的形状",
  shapeValue: (pct) => `已塑形 ${pct}%`,
  rhythmSlider: "形状的韵律",
  rhythmValue: (folds) => `${folds} 褶`,
  distanceSlider: "记忆的距离",
  distanceValue: (pct) => `远去 ${pct}%`,
  followTip: "用双手跟着动画做",
  cameraOff: "关闭摄像头",
  cameraOn: "打开摄像头",
  readThisAgain: "再读一次这段记忆",
  beginWithRecorded: "从一段录下的记忆开始",
  seeAmongOthers: "到其他记忆之间看看它",

  // ── camera dialog ──
  cameraTitle: "开启摄像头权限",
  cameraBody: "我们通过摄像头进行手势追踪，让你能亲手塑造这段记忆。请在浏览器中允许使用摄像头。",
  cameraError: "无法启动手势追踪。请在浏览器的网站设置中允许使用摄像头，然后再试一次；或改用鼠标继续。",
  startingTracking: "正在启动手势追踪…",
  tryCameraAgain: "再试一次摄像头",
  allowCamera: "允许摄像头，开始",
  maybeLater: "稍后再说",

  // ── naming ──
  namePlaceholder: "为这段记忆命名……",
  nameAria: "记忆的名字",
  yearPlaceholder: "年份",
  yearAria: "年份",
  yearDigits: "请输入四位数的年份",
  yearFuture: "那一年还没有到来",
  saveMemory: "保存记忆",
  beingMadeRead: "正在成形的记忆——阅读它的文字",
  beingMade: "正在成形的记忆",
  storageFailed: "你的浏览器无法在这次访问中保存这段记忆，存储空间可能已满或被禁用。你仍可以下载一张图片留存。",

  // ── keep a copy ──
  keepTitle: "为你的记忆留一份副本",
  keepBody1: "你正以访客身份探索 nijimu。这段记忆会在此次访问期间留在画廊中，但不会被保存，也不会公开分享。",
  keepBody2: "下载一张图片，带走它的一部分。",
  preparingMemory: "正在准备你的记忆…",
  downloadImage: "下载为图片",
  saveToPhone: "存到你的手机",
  continueWithoutDownload: "不下载，继续",
  cardAria: (title, year) => `记忆卡片：${title}，${year}`,
  imageUnprepared: "图片未能准备好。请再试一次，或不下载直接继续。",
  codeUndrawn: "未能生成二维码。请再试一次。",
  imageUnpreparedShort: "图片未能准备好。请再试一次。",
  phoneTitle: "存到你的手机",
  phoneBody: "用手机相机扫描这个二维码，即可打开并保存你的图片。这个链接的有效期为一天。",
  preparingCode: "正在生成二维码…",
  qrAlt: (link) => `${link} 的二维码`,
  tryAgain: "再试一次",
  done: "完成",
  backPane: "返回",
  phonePrepareFailed: "未能为你的手机准备这张图片。",
  phoneSendFailed: "图片未能发送。请再试一次。",
  phoneOffline: "图片未能发送。请检查网络连接，然后再试一次。",
  phoneNotSetUp: "这里尚未设置存到手机的功能。",

  // ── the phone's page ──
  keepPageTitle: "nijimu — 你的记忆",
  keepCardAlt: "你的记忆卡片",
  saveToPhotos: "存到你的相册",
  openingMemory: "正在打开你的记忆…",
  keepGone: "这张图片已不在这里。存到手机的记忆只保留一天，之后便会删除。",
  keepFailed: "未能打开这张图片。请检查网络连接，再扫描一次二维码。",

  // ── profile ──
  profile: "个人资料",
  memberSince: "加入于",
  memoriesArchived: "已收藏的记忆",
  memoriesCount: (n) => `${n} 段记忆`,
  monthYear: (year, month) => `${year} 年 ${month} 月`,
  exitToLanding: "回到首页",
};

export const MESSAGES: Record<Lang, Messages> = { en, zh };

/** The page's own language attribute for each choice. */
export const HTML_LANG: Record<Lang, string> = { en: "en", zh: "zh-Hans" };

function readStored(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const param = new URLSearchParams(window.location.search).get("lang");
    if (param === "zh" || param === "en") {
      try { window.localStorage.setItem(KEY, param); } catch { /* private window: the visit keeps it */ }
      return param;
    }
  } catch { /* no URL to read */ }
  try {
    const kept = window.localStorage.getItem(KEY);
    if (kept === "zh" || kept === "en") return kept;
  } catch { /* storage refused: the browser decides */ }
  return browserLang();
}

/** A first visit, with no choice kept: the browser's own preference — the first of its languages that is
    Chinese or English, in its order (zh-CN, zh-TW, zh-Hans… all read the Chinese interface); English when it
    names neither. Not kept: only a choice made in the header (setLang) or ?lang= is remembered, so a later
    change of the browser's language still counts until the visitor picks one. */
function browserLang(): Lang {
  try {
    const listed = window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language];
    for (const tag of listed) {
      const primary = (tag ?? "").toLowerCase().split("-")[0];
      if (primary === "zh") return "zh";
      if (primary === "en") return "en";
    }
  } catch { /* no navigator to ask */ }
  return "en";
}

let current: Lang = readStored();
const listeners = new Set<() => void>();

function applyDocumentLang() {
  if (typeof document !== "undefined") document.documentElement.lang = HTML_LANG[current];
}
applyDocumentLang();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try { window.localStorage.setItem(KEY, lang); } catch { /* kept for this visit only */ }
  applyDocumentLang();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The chosen language; re-renders when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => "en" as Lang);
}

/** The dictionary in the chosen language; re-renders when it changes. */
export function useT(): Messages {
  return MESSAGES[useLang()];
}

/** The dictionary as it stands now, for code outside render (an error set in a callback). */
export function messages(): Messages {
  return MESSAGES[current];
}
