// Top-level entry for the Flashcard Survivors mode. Owns the state machine:
//   menu → playing → game-over → menu, plus the mastery sub-screen.
//
// Lazy-loaded from the router (the engine + Canvas paths shouldn't bloat
// the main bundle for users who never open this mode).

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SurvivorDifficulty, SurvivorInputMode } from "../../db";
import { GameEngine } from "./engine/GameEngine";
import { KeyboardInput } from "./engine/KeyboardInput";
import { TapInput } from "./engine/TapInput";
import { buildSurvivorPool } from "./engine/cardPool";
import { DeckSelectScreen } from "./ui/DeckSelectScreen";
import { HUD } from "./ui/HUD";
import { LevelUpModal } from "./ui/LevelUpModal";
import { GameOverScreen } from "./ui/GameOverScreen";
import { MasteryTreeScreen } from "./ui/MasteryTreeScreen";
import { TypingInput } from "./ui/TypingInput";
import { TapChoiceTray } from "./ui/TapChoiceTray";
import { recordRun, useMastery } from "./persistence/survivorStore";
import type { EnemyView, RunSummary } from "./engine/types";
import type { UpgradeChoice } from "./upgrades/pool";
import { applyMasteryEffects } from "./mastery/effects";

type Screen = "menu" | "mastery" | "playing" | "gameover";

export default function FlashcardSurvivorsSession() {
  const [screen, setScreen] = useState<Screen>("menu");
  const navigate = useNavigate();
  const mastery = useMastery();

  // Live run state.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<KeyboardInput | TapInput | null>(null);
  const [runConfig, setRunConfig] = useState<{
    deckIds: string[];
    difficulty: SurvivorDifficulty;
    inputMode: SurvivorInputMode;
  } | null>(null);
  const [enemies, setEnemies] = useState<EnemyView[]>([]);
  const [levelUp, setLevelUp] = useState<UpgradeChoice[] | null>(null);
  const [gameOver, setGameOver] = useState<RunSummary | null>(null);

  // ---- Start a run ----
  const start = (cfg: {
    deckIds: string[];
    difficulty: SurvivorDifficulty;
    inputMode: SurvivorInputMode;
  }) => {
    setRunConfig(cfg);
    setLevelUp(null);
    setGameOver(null);
    setEnemies([]);
    setScreen("playing");
  };

  // Mount the engine after the canvas exists.
  useEffect(() => {
    if (screen !== "playing" || !runConfig || !canvasRef.current) return;
    let cancelled = false;

    const init = async () => {
      const masteryNodes = mastery?.unlockedNodes ?? [];
      const engine = new GameEngine(canvasRef.current!, {
        decks: runConfig.deckIds,
        difficulty: runConfig.difficulty,
        inputMode: runConfig.inputMode,
        masteryNodes,
      });
      engineRef.current = engine;

      // Pick + attach an input strategy.
      let input: KeyboardInput | TapInput;
      if (runConfig.inputMode === "tap") {
        const pool = await buildSurvivorPool(runConfig.deckIds);
        input = new TapInput(pool);
      } else {
        input = new KeyboardInput();
      }
      inputRef.current = input;
      engine.setInputMode(input);

      // Event subscription for visuals + UI triggers.
      engine.addEventListener((event) => {
        if (cancelled) return;
        if (event.type === "enemiesChanged") setEnemies(event.visible);
        else if (event.type === "levelUp") setLevelUp(event.choices);
        else if (event.type === "gameOver") {
          setGameOver(event.summary);
          void recordRun(event.summary);
          setScreen("gameover");
        }
      });

      await engine.start();
    };
    void init();

    const onResize = () => engineRef.current?.handleResize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      engineRef.current?.stop();
      engineRef.current = null;
      inputRef.current = null;
    };
  }, [screen, runConfig, mastery?.unlockedNodes]);

  // Canvas tap → engine.pickEnemyAt (Tap Mode only).
  const onCanvasTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!engineRef.current || !inputRef.current) return;
    if (inputRef.current.id !== "tap") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const enemy = engineRef.current.pickEnemyAt(x, y);
    if (enemy) (inputRef.current as TapInput).selectTarget(enemy.id);
    else (inputRef.current as TapInput).deselect();
  };

  // ---- Render ----

  if (screen === "menu") {
    return (
      <DeckSelectScreen
        onStart={start}
        onOpenMastery={() => setScreen("mastery")}
        onClose={() => navigate("/")}
      />
    );
  }
  if (screen === "mastery") {
    return <MasteryTreeScreen onClose={() => setScreen("menu")} />;
  }

  // Playing or gameover — the canvas stays mounted underneath.
  const weaponCap =
    applyMasteryEffects(mastery?.unlockedNodes ?? []).weaponCap;
  return (
    <div className="fixed inset-0 z-40 bg-[#0b1320] text-cream">
      <canvas
        ref={canvasRef}
        onPointerDown={onCanvasTap}
        className="absolute inset-0 h-full w-full touch-none"
      />
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none">
        {/* Card-front labels on each enemy. Pointer-events stay off so the
            canvas keeps receiving taps (Tap Mode). */}
        {enemies.map((e) => (
          <div
            key={e.id}
            style={{
              position: "absolute",
              left: e.pos.x,
              top: e.pos.y + e.size * 0.5 + 6,
              transform: "translate(-50%, 0)",
              maxWidth: Math.max(140, e.size * 3),
              textAlign: "center",
              padding: "2px 6px",
              fontSize: 11,
              borderRadius: 4,
              background: "rgba(0,0,0,0.45)",
              color: "white",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {e.front}
          </div>
        ))}
      </div>

      {engineRef.current && (
        <HUD
          engine={engineRef.current}
          weaponCap={weaponCap}
          onExit={() => engineRef.current?.quit()}
        />
      )}

      {runConfig?.inputMode === "keyboard" && inputRef.current?.id === "keyboard" && (
        <TypingInput input={inputRef.current as KeyboardInput} />
      )}
      {runConfig?.inputMode === "tap" && inputRef.current?.id === "tap" && engineRef.current && (
        <TapChoiceTray engine={engineRef.current} input={inputRef.current as TapInput} />
      )}

      {levelUp && engineRef.current && (
        <LevelUpModal
          engine={engineRef.current}
          choices={levelUp}
          onClose={() => setLevelUp(null)}
        />
      )}

      {gameOver && (
        <GameOverScreen
          summary={gameOver}
          onPlayAgain={() => {
            if (!runConfig) return;
            // Trigger a fresh effect cycle by toggling screen away first.
            setScreen("menu");
            setTimeout(() => start(runConfig), 0);
          }}
          onExit={() => setScreen("menu")}
        />
      )}
    </div>
  );
}
