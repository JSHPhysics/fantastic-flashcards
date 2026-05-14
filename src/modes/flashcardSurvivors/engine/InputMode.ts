// Input-mode strategy interface (Survivors-Spec §2.6).
//
// The engine doesn't know whether it's serving a keyboard or tap player —
// it just calls attach/detach/tick. Each strategy is responsible for
// emitting "correctAnswer" events into the engine via the supplied handle.
//
// Mode is fixed at run start in v1; mid-run switching would require
// detaching the active strategy and attaching the new one.

import type { GameEngine } from "./GameEngine";

export interface InputModeAttach {
  // Engine handle the strategy uses to peek at on-screen enemies + fire
  // the Recall Cannon when it decides the player has correctly answered.
  engine: GameEngine;
  // Called by the strategy when the user submits something that DOESN'T
  // match — the engine resets the streak.
  onMiss: () => void;
}

export interface InputMode {
  attach(handle: InputModeAttach): void;
  detach(): void;
  // Called every engine tick — keyboard mode is event-driven and ignores
  // this; tap mode uses it to time out tap-choice trays if needed.
  onTick(dtMs: number): void;
  // String ID for save data + analytics.
  readonly id: "keyboard" | "tap";
}
