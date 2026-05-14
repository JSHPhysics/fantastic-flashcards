// Tap-mode input strategy (Survivors-Spec §2.6.2).
//
// Two-step interaction:
//   1. selectTarget(id) — engine builds + caches a 4-choice tray for that
//      enemy (correct answer + 3 distractors from the same deck pool).
//   2. submitChoice(text) — if matches the correct answer, lock + fire;
//      otherwise reset streak and clear tray.
//
// Distractor pool: backs of all OTHER basic cards in the selected deck(s),
// cached per card per run so re-encounters always show the same 4 choices
// — prevents lucky-guess gaming via reshuffling, and aids learning.

import type { Card } from "../../../db";
import type { InputMode, InputModeAttach } from "./InputMode";
import { cardBack, normaliseAnswer } from "./cardPool";

export class TapInput implements InputMode {
  readonly id = "tap" as const;
  private handle: InputModeAttach | null = null;
  // Pool of *all* basic-card backs in the selected deck combination —
  // used to source distractors. Cached at construction.
  private distractorPool: string[];
  // Per-card 4-choice cache. Keyed by card id; once a card's tray is
  // generated it never changes for the run.
  private trayCache = new Map<string, string[]>();
  private selectedEnemyId: string | null = null;
  private selectedAt = 0;
  // Engine's current tick time stamp, captured each onTick. Used as the
  // clock for "time from select to submit" speed bonus.
  private now = 0;

  constructor(basicCardPool: Card[]) {
    this.distractorPool = basicCardPool
      .map((c) => cardBack(c))
      .filter((s) => s.trim().length > 0);
  }

  attach(handle: InputModeAttach): void {
    this.handle = handle;
  }
  detach(): void {
    this.handle = null;
    this.selectedEnemyId = null;
    this.trayCache.clear();
  }
  onTick(_dtMs: number): void {
    if (!this.handle) return;
    this.now = this.handle.engine.tickTime();
  }

  // Called by the React canvas overlay when the user taps an enemy.
  selectTarget(enemyId: string): void {
    if (!this.handle) return;
    const enemy = this.handle.engine.findEnemy(enemyId);
    if (!enemy) return;
    const correct = cardBack(enemy.card);
    // Build / retrieve the 4-choice tray. Cache the first generation so
    // re-encounters of the same card show the same options.
    let choices = this.trayCache.get(enemy.card.id);
    if (!choices) {
      choices = this.buildChoices(correct);
      this.trayCache.set(enemy.card.id, choices);
    }
    this.selectedEnemyId = enemyId;
    this.selectedAt = this.handle.engine.tickTime();
    this.handle.engine.broadcastTapChoices(enemyId, choices);
  }

  // Called by the React TapChoiceTray when the user picks an option.
  submitChoice(answer: string): void {
    if (!this.handle || this.selectedEnemyId === null) return;
    const enemy = this.handle.engine.findEnemy(this.selectedEnemyId);
    const selectedAt = this.selectedAt;
    this.selectedEnemyId = null;
    this.selectedAt = 0;
    this.handle.engine.broadcastTapCleared();
    if (!enemy) return;
    const correct = normaliseAnswer(cardBack(enemy.card));
    if (normaliseAnswer(answer) === correct) {
      // Speed bonus uses select->submit time; tighter window than
      // keyboard mode because selection is deliberate.
      this.handle.engine.recordCorrectAnswer(enemy.id, { speedBonusBaseMs: this.now - selectedAt });
    } else {
      this.handle.onMiss();
    }
  }

  // Called when the user taps empty canvas — clears selection without
  // resetting the streak (deliberate de-select shouldn't penalise).
  deselect(): void {
    if (!this.handle) return;
    this.selectedEnemyId = null;
    this.selectedAt = 0;
    this.handle.engine.broadcastTapCleared();
  }

  // Build a 4-element answer array: correct + 3 distractors, shuffled.
  // Distractors are deduplicated against the correct answer
  // (case-insensitive, whitespace-normalised) per spec.
  private buildChoices(correct: string): string[] {
    const correctNorm = normaliseAnswer(correct);
    const candidates = this.distractorPool.filter(
      (s) => normaliseAnswer(s) !== correctNorm,
    );
    const picked = new Set<string>();
    // Deterministic-ish but lightly randomised — Fisher-Yates over a copy.
    const shuffled = candidates.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (const c of shuffled) {
      if (picked.size >= 3) break;
      if ([...picked].every((p) => normaliseAnswer(p) !== normaliseAnswer(c))) {
        picked.add(c);
      }
    }
    const out = [correct, ...picked];
    // Shuffle the final 4 so the correct answer isn't always first.
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
