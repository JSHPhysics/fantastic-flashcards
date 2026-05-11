# FantasticFlashcards: Project Playbook (v1.0)

Author: Joshua Stafford-Haworth (JSHPhysics)

A local-first, privacy-respecting flashcards PWA. No accounts, no backend, no tracking, no subscription. Designed for iPad-first use by teenagers, with full desktop parity. Spaced repetition via FSRS. Cross-device sync via manual backup files saved to OneDrive (or any cloud/local storage the user chooses).

Repository: https://github.com/JSHPhysics/fantastic-flashcards

---

## 1. Goals and non-goals

### Goals
- Quizlet-quality UX, Anki-quality scheduling.
- Fully offline after first load.
- Zero data collection. Nothing leaves the device unless the student explicitly exports.
- Six card types covering all common study patterns including diagram-based and drawing-based learning.
- Text, image, audio, and pen-drawing content per card.
- Sub-deck hierarchy and cross-cutting tags for organisation at scale.
- TTS pronunciation for language learning, free and on-device.
- Authoring on iPad and desktop with parity.
- Engagement: streaks, session summaries, progress graphs, shareable stats.
- Manual backup/restore via a single file. OneDrive-friendly but not OneDrive-dependent.

### Non-goals
- No cloud accounts, no server-side anything, no Azure/Graph integration.
- No social features, no leaderboards across users, no chat.
- No simulation of Anki's full plugin surface (templates as a generic system, third-party extensions).
- No AI-generated questions in v1.
- No auto-grading of drawings (self-grading is the deliberate model).

---

## 2. Technical stack

| Concern | Choice | Rationale |
|---|---|---|
| Build tool | Vite | Fast dev server, small static output |
| Framework | React 18 + TypeScript | Familiar, well-supported |
| Styling | Tailwind CSS | Fast iteration, consistent design tokens |
| Local storage | Dexie.js (IndexedDB wrapper) | Handles tens of thousands of records, transactional, typed |
| Spaced repetition | ts-fsrs | Modern FSRS algorithm |
| PWA / offline | Workbox via vite-plugin-pwa | Service worker generation, precache |
| Compression | Native Canvas API for images, native MediaRecorder for audio | No heavy dependencies |
| Zip handling | fflate (for backup files) | Tiny, fast, pure JS |
| Charts | Recharts | Touch-friendly, declarative |
| Image cropping | react-easy-crop | Touch-aware, pinch-zoom on iPad |
| Canvas (occlusion + drawing) | Konva.js + react-konva | Mature, touch-handling, selection/handles built-in |
| TTS | Web Speech API (SpeechSynthesis) | Free, on-device, no account |
| Hosting | GitHub Pages | Matches existing JSHPhysics infrastructure |

No backend. No analytics. No telemetry. No external font CDN at runtime (fonts bundled). Konva lazy-loaded on editor routes only.

---

## 3. Data model

All data lives in IndexedDB via Dexie. One database, versioned schema.

### Database: `fantastic-flashcards`

#### Table: `profile` (singleton, key = "self")
```ts
interface Profile {
  id: "self";
  displayName: string;
  createdAt: number;
  version: number;          // monotonic counter
  lastChangeAt: number;
  lastBackupAt: number;
  streakDays: number;
  longestStreak: number;
  lastReviewDate: string;   // ISO date YYYY-MM-DD
  restDayUsedDate?: string;
  settings: ProfileSettings;
}

interface ProfileSettings {
  themeMode: "light" | "dark" | "system";
  audioAutoplayOnShow: boolean;
  audioAutoplayOnReveal: boolean;
  ttsAutoplayOnShow: boolean;
  ttsAutoplayOnReveal: boolean;
  showTimerInSession: boolean;
  defaultDailyNewLimit: number;       // default 20
  defaultDailyReviewLimit: number;    // default 200
}
```

#### Table: `decks`
```ts
interface Deck {
  id: string;
  parentId?: string;          // sub-deck parent; root if absent
  name: string;
  description?: string;
  subject?: string;
  colour: string;
  pronunciationLanguage?: string;     // BCP 47
  createdAt: number;
  updatedAt: number;
  cardCount: number;                  // direct children only
  descendantCardCount: number;        // includes sub-decks
  mediaBytes: number;
}
```

Sub-deck rules:
- Unlimited nesting depth.
- When creating a sub-deck that would result in depth > 4, show a non-blocking modal: "You are about to create a 5th level of nesting. Most decks work best at 3-4 levels. Continue?"
- Studying a deck includes all descendants by default; a toggle in the study setup screen offers "this deck only".

#### Table: `cards`
```ts
type CardType = "basic" | "cloze" | "mcq" | "typed" | "occlusion" | "drawing";

interface Card {
  id: string;
  deckId: string;
  type: CardType;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  content: CardContent;
  fsrs: FsrsState;
  suspended: boolean;
  generatedFromCardId?: string;       // auto-reverse and auto-listening cards
}

interface BasicContent {
  type: "basic";
  front: RichField;
  back: RichField;
  autoReverse: boolean;               // flag on source card; reverse stored as separate Card
}

interface ClozeContent {
  type: "cloze";
  text: string;                       // contains {{c1::hidden}}, {{c2::hidden}} markers
  clozeNumber: number;                // which c-number this card masks
  extra?: RichField;
}

interface McqContent {
  type: "mcq";
  question: RichField;
  options: { id: string; text: string; correct: boolean }[];
  shuffleOptions: boolean;
  explanation?: RichField;
}

interface TypedContent {
  type: "typed";
  prompt: RichField;
  acceptedAnswers: string[];
  caseSensitive: boolean;
  ignorePunctuation: boolean;
  explanation?: RichField;
}

interface OcclusionContent {
  type: "occlusion";
  imageHash: string;
  masks: OcclusionMask[];             // full set; cards share the set
  activeMaskId: string;               // mask (or group) this card occludes
  mode: "hide-one" | "hide-all";
  extra?: RichField;
}

interface OcclusionMask {
  id: string;
  groupId?: string;                   // hide/reveal together
  shape: "rect" | "ellipse" | "polygon";
  geometry: RectGeom | EllipseGeom | PolygonGeom;  // 0-1 normalised coords
  label?: string;
}

interface DrawingContent {
  type: "drawing";
  prompt: RichField;
  backgroundImageHash?: string;       // optional diagram to draw on
  modelAnswerImageHash: string;       // reference answer for self-comparison
  revealMode: "overlay" | "side-by-side" | "toggle";
  extra?: RichField;
}

interface RichField {
  text: string;
  imageHash?: string;
  audioHash?: string;
  language?: string;                  // BCP 47 override for TTS
}
```

Auto-generation rules:
- Basic with `autoReverse: true` → on save, a paired Card is created with front and back swapped and `generatedFromCardId` set. Edits to the source propagate; deletion cascades.
- Any field with audio → editor offers "Also create a listening card" checkbox. A separate listening-variant card is created and linked.
- Field with `language` set + no recorded audio → listening card uses TTS at review time.

#### Table: `media`
```ts
interface MediaBlob {
  hash: string;                       // SHA-256 of compressed blob
  mimeType: string;
  bytes: number;
  blob: Blob;
  refCount: number;
  createdAt: number;
}
```

#### Table: `reviews`
```ts
interface ReviewEvent {
  id: string;
  cardId: string;
  deckId: string;
  timestamp: number;
  rating: 1 | 2 | 3 | 4;
  timeTakenMs: number;
  previousState: FsrsState;
  nextState: FsrsState;
  sessionId: string;
}
```

#### Table: `sessions`
```ts
interface Session {
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

interface CustomStudyConfig {
  deckIds: string[];
  includeSubDecks: boolean;
  tagFilter?: { tags: string[]; mode: "any" | "all" };
  cardTypeFilter?: CardType[];
  recentMistakes?: { withinDays: number };
  maxCards: number;
  shuffle: boolean;
}
```

### Tags
- Flat namespace, lowercase, kebab-case.
- Stored as a string array on each card.
- Dexie multi-entry index for fast filtering.
- Type-ahead autocomplete drawing from a derived "all known tags" set.

### Version counter rules
- `profile.version` increments on every meaningful change (card/deck/tag mutations, session completion, settings change).
- `profile.lastChangeAt` set to `Date.now()` on the same events.
- `profile.lastBackupAt` set on successful backup export.
- Backup nudge condition: `lastChangeAt > lastBackupAt` AND `Date.now() - lastBackupAt > 20 * 60 * 60 * 1000`.

---

## 4. Backup file format

Single `.flashcards` file. Internally a zip.

### Structure
```
backup-2026-05-11T1430-v847.flashcards
|-- manifest.json
|-- profile.json
|-- decks.json
|-- cards.json
|-- reviews.json
|-- sessions.json
+-- media/
    |-- <hash1>.webp
    |-- <hash2>.aac
    +-- ...
```

### Import logic
1. Parse manifest, validate schemaVersion.
2. Compare `profileVersion` with local.
3. Higher: full replace, with confirmation dialog showing diff summary.
4. Lower: warn "this is an older backup", offer to import anyway.
5. Equal: "already up to date".

No merge logic in v1. Last-write-wins at the file level.

---

## 5. Media pipeline

### Images
1. Read as ImageBitmap.
2. Optional crop step via react-easy-crop.
3. Resize on canvas: max 1000px on the long edge.
4. Encode as WebP at quality 0.82.
5. SHA-256 hash, dedupe via media table refCount.

### Audio
1. MediaRecorder, mono, lowest available bitrate.
2. Hard cap 15 seconds with visible countdown.
3. Imported files capped at 200KB.
4. Same hash + refCount flow.

### Storage indicators
- Per-deck size chip: green (<20MB), amber (20-100MB), red (>100MB).
- Device-total in Settings via `navigator.storage.estimate()`.
- No hard cap. Inform, don't block.

### Garbage collection
- Decrement refCount on card delete or media replacement.
- Sweep media table on profile load each app session, delete refCount <= 0.

---

## 6. Pronunciation / TTS

- Each deck has an optional `pronunciationLanguage` (BCP 47).
- Each `RichField` can override the deck's language.
- Speaker icon appears wherever a field with a language is displayed.
- Voice list via `speechSynthesis.getVoices()` with `voiceschanged` listener for iOS async load.
- Auto-speak settings: on show, on reveal (independent toggles).
- Settings explainer: "Voice quality depends on languages installed on your device. On iPad, download Enhanced voices in Settings -> Accessibility -> Spoken Content for best results."
- Listening card auto-generation falls back to TTS at review time when language is set but no audio recorded.

---

## 7. Review session UX

### Session selection
- Standard: pick a deck (or "Mixed across selected decks"). Subdeck toggle.
- Custom Study: pick decks + filters (tags, types, recent mistakes, max cards, shuffle).

### Per-card UI
- Top bar: progress, session time (if enabled), deck name, Exit.
- Card body: front shown, "Show Answer" button.
- TTS speaker icon if language set; auto-plays per settings.
- On reveal: back shown, four rating buttons (Again | Hard | Good | Easy).

### Card-type-specific flows
- **Basic / Cloze:** four-button rating.
- **MCQ:** tap option -> immediate green/red feedback -> Continue. Rating inferred: correct first try = Good, wrong = Again.
- **Typed:** input + Submit -> normalised comparison -> diff shown -> Continue. Exact = Good, close (Levenshtein <= 2) = Hard, else = Again.
- **Occlusion:** image with active mask(s) hidden per mode. Tap to reveal. Four-button rating.
- **Drawing:** prompt + canvas. Student draws. "Show Answer" reveals model per `revealMode`. Toggle button cycles overlay / side-by-side / your-drawing-only. Four-button self-rating. Drawing discarded after rating.

### Session end
- Summary: cards reviewed, accuracy %, time spent, streak update, rating breakdown chart.
- Share / Done buttons.

### Streak rules
- Streak day = any calendar day with >= 1 card reviewed.
- One rest day allowed per streak (tracked via `restDayUsedDate`).
- 2+ consecutive missed days = reset.

---

## 8. Authoring UX

### Deck management
- Tree view with collapsible sub-deck nodes.
- "+" creates root deck or sub-deck (context-aware).
- Sub-deck depth warning at >4.
- Long-press / right-click menu: Rename, Edit, Duplicate (with cards), Move, Delete.

### Card editor
- Type tabs: Basic / Cloze / MCQ / Typed / Occlusion / Drawing.
- Frozen fields: "freeze" toggle on deck, tags, type, language. Frozen values persist across consecutive new-card creations.
- Live preview pane.
- Save / Save and add another / Cancel.

### Occlusion authoring
- Pick image -> Konva canvas overlay -> tools: rect, ellipse, polygon, group, label, delete.
- Touch hit targets 32px even with smaller visual handles.
- "Done" button exits draw mode to allow page scroll (prevents the standard touch-canvas conflict).
- Mode: hide-one (default) or hide-all.
- Save creates N cards from one authoring action; editing the mask set updates all.

### Drawing authoring
- Set prompt + optional background diagram.
- Draw model answer on the canvas (or upload an image).
- Choose reveal mode: overlay / side-by-side / toggle.
- Save.

### Tags
- Multi-select input on every card.
- Autocomplete from known tags.
- Bulk tag editor on deck detail (multi-select cards -> Add tag / Remove tag).

---

## 9. Stats and history

- Today: cards reviewed, accuracy ring, time, streak with rest-day indicator.
- This Week: bar chart of cards per day, accuracy line overlay, drill-down on bar tap.
- All Time: GitHub-style heatmap calendar.
- Per-deck: mature (interval > 21 days) / learning / new breakdown, mastery donut chart.
- Share weekly stats / session summary as PNG via Web Share API.

---

## 10. PWA configuration

- Manifest: standalone display, theme colour, 192/512/maskable-512 icons.
- Workbox: precache app shell, no runtime cache needed.
- iOS install tip on first launch in browser tab.
- `navigator.storage.persist()` after first successful session.
- Persistent storage status surfaced in Settings.
- Update banner when new SW waiting.

---

## 11. Design system

### Palette (light mode)
- Background: warm cream `#FAF7F2`
- Surface: pure white `#FFFFFF`
- Primary: navy `#1E3A5F`
- Primary accent: warm gold `#C9A14A`
- Again: `#C44545`
- Hard: `#D4912E`
- Good: `#3E8E63`
- Easy: `#3D7AB8`

Dark mode mirrors with adjusted contrast.

### Typography, spacing, motion
- System font stack.
- Card content large with generous line height; UI chrome tighter.
- Tailwind defaults, rounded-2xl on primary surfaces, generous card padding.
- 150-200ms transitions. Respect `prefers-reduced-motion`.

### Touch
- 44pt minimum tap targets app-wide.
- Canvas tools: 32pt hit areas even with smaller visual handles.

### Voice and copy

Every user-visible string in the app is read by a student, not a developer. Treat copy as a first-class design surface.

**Principles**
- Plain English. Describe what the user sees or does, not how the code is structured.
- Cause-and-effect framing beats abstract description. "Editing this card updates both" reads better than "edits propagate".
- Use the user's vocabulary, not the codebase's.
- Concrete examples beat abstract rules. Hints that include an example outperform hints that try to define the format.
- No roadmap leaks. Code comments may reference "Session 10"; UI strings never do. Unimplemented surfaces say "coming soon".

**Words to avoid in user-visible strings**
- Implementation jargon: *chip, endpoint, propagate, cascade, sibling, materialise, idempotent, refcount, deprecate, payload, dispatcher*.
- Coding terms: *kebab-case, camelCase, regex, JSON, primary key, foreign key, schema*.
- Process terms students don't know: *author* (for *make*), *root* (for *top level*), *transient* (for *temporary*).
- Brand-internal scheduling: *Session 4, ships in v1*, etc.

**Concrete swaps that have already landed (use as the pattern)**

| Before | After |
|---|---|
| "Optional. Used as a chip on the row." | "Optional. Shows as a small tag next to the deck name." |
| "Lowercase, kebab-case suggested." | "Use short labels with hyphens for spaces, e.g. `french-vocab`, `hard`." |
| "Generates a sibling card with front and back swapped. Edits to this card propagate; delete cascades." | "Makes a second card with the front and back swapped. Editing this card updates both; deleting this card deletes the pair." |
| "Wrap blanks with `{{c1::hidden}}`. c1, c2, c3 number automatically." | "Type your text, then select what you want hidden and tap the button below. Multiple blanks (c1, c2, c3...) are numbered automatically." |
| "Comma-separated. Any one is correct." | "Separate alternatives with commas. Any one will count as correct." |
| "Spaced repetition review sessions arrive in Session 10." | "Study sessions with spaced repetition are coming soon." |
| "Theme, audio, daily limits, backup. Backup buttons arrive in Session 13." | "Audio, pronunciation, storage. Backup options are coming soon." |
| "Tap Add card to author the first one." | 'Tap "Add card" to create your first one.' |

**Buttons**
- Verb first, object second: *Add card*, *Hide selected text*, *Wipe everything*.
- The button label should describe the result, not the mechanism. *Hide selected text* > *Wrap selection in cloze*.

**Toggles**
- Each toggle should make sense without context. Pair lines like "Play recorded audio on show / on reveal" need to expand to "Play recorded audio when a card appears / when the answer is revealed".

**Internal naming is exempt**
This applies to user-visible strings only. Code-side identifiers — props called `pronunciationLanguage`, `variant="primary"`, table columns, type names — stay in their existing technical conventions.

---

## 12. Privacy and data posture

- All data on-device. No network requests after initial load except SW updates.
- No analytics, error reporting, runtime font CDNs.
- Backup files explicitly user-initiated.
- Privacy notice in plain English, accessible from Settings.

---

## 13. Future (not v1)

- AI-assisted card generation
- Teacher-published public deck catalogue
- Custom card templates as a generic system
- Image occlusion variants (cloze on labels)
- Timed drill mode
- Folder watcher sync (when File System Access API ships in Safari)
