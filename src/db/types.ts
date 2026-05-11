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
  pronunciationLanguage?: string;
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
