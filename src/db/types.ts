// Entity types for the Dexie data layer.
// Mirrors Playbook section 3 exactly so backup files round-trip without translation.

import type { Card as FsrsCard } from "ts-fsrs";

// FSRS state is whatever ts-fsrs uses; aliased so the scheduler can swap impls
// without rippling through every record type.
export type FsrsState = FsrsCard;

// ---- Profile ----

export interface ProfileSettings {
  themeMode: "light" | "dark" | "system";
  audioAutoplayOnShow: boolean;
  audioAutoplayOnReveal: boolean;
  ttsAutoplayOnShow: boolean;
  ttsAutoplayOnReveal: boolean;
  showTimerInSession: boolean;
  defaultDailyNewLimit: number;
  defaultDailyReviewLimit: number;
  // Off by default. When enabled, Settings exposes the sample-data seeder and
  // the wipe-everything button. Toggling persists in the profile so a backup
  // round-trip preserves it.
  debugMode?: boolean;
  // Off by default. When enabled, pronunciation goes through Google's
  // translate-TTS endpoint instead of the local speechSynthesis voices.
  // Every speak() call sends the field text to Google. Off-by-default keeps
  // the local-first promise intact; the user opts in explicitly when they
  // want authentic accents without installing platform voices.
  useOnlineVoices?: boolean;
}

export interface Profile {
  id: "self";
  displayName: string;
  createdAt: number;
  version: number;
  lastChangeAt: number;
  lastBackupAt: number;
  streakDays: number;
  longestStreak: number;
  lastReviewDate: string;
  restDayUsedDate?: string;
  settings: ProfileSettings;
}

// ---- Deck ----

export interface Deck {
  id: string;
  parentId?: string;
  name: string;
  description?: string;
  subject?: string;
  colour: string;
  // BCP 47 of the primary (target / front) language. Speaker icons on the
  // front of Basic cards and on every RichField across other card types use
  // this when no per-field override is set.
  pronunciationLanguage?: string;
  // BCP 47 of the secondary (native / translation / back) language. When
  // both pronunciationLanguage and secondaryLanguage are set the deck is
  // "bilingual" and the back of a Basic card defaults to this. When only
  // pronunciationLanguage is set the back falls back to that (single-
  // language deck, same as before this field existed).
  secondaryLanguage?: string;
  // BCP 47 of the student's own language for this deck. When set, auto-TTS
  // during review never speaks this language: it speaks the *other* side
  // instead. The point is that an English speaker learning Spanish always
  // hears the Spanish word read aloud, whether the card is showing the
  // English or the Spanish side. Must match one of pronunciationLanguage or
  // secondaryLanguage. Undefined means "no preference" — auto-TTS reads
  // whichever side it's currently looking at.
  baseLanguage?: string;
  createdAt: number;
  updatedAt: number;
  cardCount: number;
  descendantCardCount: number;
  mediaBytes: number;
}

// ---- Cards ----

export type CardType =
  | "basic"
  | "cloze"
  | "mcq"
  | "typed"
  | "occlusion"
  | "drawing";

export interface RichField {
  text: string;
  imageHash?: string;
  audioHash?: string;
  language?: string;
}

export interface BasicContent {
  type: "basic";
  front: RichField;
  back: RichField;
  autoReverse: boolean;
}

export interface ClozeContent {
  type: "cloze";
  text: string;
  clozeNumber: number;
  extra?: RichField;
}

export interface McqOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface McqContent {
  type: "mcq";
  question: RichField;
  options: McqOption[];
  shuffleOptions: boolean;
  explanation?: RichField;
}

export interface TypedContent {
  type: "typed";
  prompt: RichField;
  acceptedAnswers: string[];
  caseSensitive: boolean;
  ignorePunctuation: boolean;
  explanation?: RichField;
}

export interface RectGeom {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EllipseGeom {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface PolygonGeom {
  points: [number, number][];
}

export interface OcclusionMask {
  id: string;
  groupId?: string;
  shape: "rect" | "ellipse" | "polygon";
  geometry: RectGeom | EllipseGeom | PolygonGeom;
  label?: string;
}

export interface OcclusionContent {
  type: "occlusion";
  imageHash: string;
  masks: OcclusionMask[];
  activeMaskId: string;
  mode: "hide-one" | "hide-all";
  extra?: RichField;
}

export interface DrawingContent {
  type: "drawing";
  prompt: RichField;
  backgroundImageHash?: string;
  modelAnswerImageHash: string;
  revealMode: "overlay" | "side-by-side" | "toggle";
  extra?: RichField;
}

export type CardContent =
  | BasicContent
  | ClozeContent
  | McqContent
  | TypedContent
  | OcclusionContent
  | DrawingContent;

export interface Card {
  id: string;
  deckId: string;
  type: CardType;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  content: CardContent;
  fsrs: FsrsState;
  suspended: boolean;
  generatedFromCardId?: string;
}

// ---- Media ----

export interface MediaBlob {
  hash: string;
  mimeType: string;
  bytes: number;
  blob: Blob;
  refCount: number;
  createdAt: number;
}

// ---- Review history ----

export type Rating = 1 | 2 | 3 | 4;

export interface ReviewEvent {
  id: string;
  cardId: string;
  deckId: string;
  timestamp: number;
  rating: Rating;
  timeTakenMs: number;
  previousState: FsrsState;
  nextState: FsrsState;
  sessionId: string;
}

// ---- Sessions ----

export interface CustomStudyConfig {
  deckIds: string[];
  includeSubDecks: boolean;
  tagFilter?: { tags: string[]; mode: "any" | "all" };
  cardTypeFilter?: CardType[];
  recentMistakes?: { withinDays: number };
  maxCards: number;
  shuffle: boolean;
}

export interface Session {
  id: string;
  startedAt: number;
  endedAt: number;
  deckIds: string[];
  cardsReviewed: number;
  cardsCorrect: number;
  totalTimeMs: number;
  mode: "standard" | "custom-study";
  customStudyConfig?: CustomStudyConfig;
}
