// Keyboard input strategy (Survivors-Spec §2.6.1).
//
// The React HUD owns the actual <input> element — we don't grab keys here,
// we just expose a setBuffer() method that the input's onChange wires up.
// The strategy live-matches the buffer against every on-screen enemy's
// back-text. First exact match (normalised) wins.

import type { InputMode, InputModeAttach } from "./InputMode";
import { cardBack, normaliseAnswer } from "./cardPool";

export class KeyboardInput implements InputMode {
  readonly id = "keyboard" as const;
  private handle: InputModeAttach | null = null;
  // External: the React TypingInput drives this. We expose setBuffer +
  // onSubmit (Enter) hooks.
  private buffer = "";

  attach(handle: InputModeAttach): void {
    this.handle = handle;
  }
  detach(): void {
    this.handle = null;
    this.buffer = "";
  }
  onTick(): void {
    // No-op — keyboard mode is event-driven via setBuffer.
  }

  // Called by the React input's onChange. Each keystroke we look for an
  // exact match against any visible enemy's back text. First match locks +
  // fires Recall Cannon + clears the buffer.
  setBuffer(next: string): void {
    this.buffer = next;
    if (!this.handle) return;
    const target = normaliseAnswer(next);
    if (target.length === 0) return;
    const enemy = this.handle.engine
      .visibleEnemies()
      .find((e) => normaliseAnswer(cardBack(e.card)) === target);
    if (enemy) {
      this.handle.engine.recordCorrectAnswer(enemy.id);
      this.buffer = "";
    }
  }

  // Called when the user hits Enter without an exact match.
  submitWithNoMatch(): void {
    if (!this.handle) return;
    this.handle.onMiss();
    this.buffer = "";
  }

  getBuffer(): string {
    return this.buffer;
  }
}
