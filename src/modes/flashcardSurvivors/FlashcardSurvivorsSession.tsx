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
import { PauseScreen } from "./ui/PauseScreen";
import { HowToPlayModal } from "./ui/HowToPlayModal";
import { recordRun, useMastery } from "./persistence/survivorStore";
import type { EnemyView, OwnedWeapon, PlayerStats, RunSummary } from "./engine/types";
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
  // Manual pause overlay: separate from levelUp (engine pauses itself
  // automatically for level-up), and dismissable from a button + Esc/P.
  // We also keep the latest stats/weapons snapshot here so the pause
  // screen can show numbers without re-subscribing to the engine.
  const [paused, setPaused] = useState(false);
  const [latestPlayer, setLatestPlayer] = useState<PlayerStats | null>(null);
  const [latestWeapons, setLatestWeapons] = useState<OwnedWeapon[]>([]);
  // How-to-play modal — auto-opens before the first run, and is the
  // explicit gate between the deck-select Start button and the engine
  // actually beginning to spawn enemies. Returning players who tick
  // "Got it" persist that to localStorage and skip the auto-open.
  // The Help button on DeckSelect can re-open it any time.
  const [introOpen, setIntroOpen] = useState(false);
  // Tracks whether the intro is showing as the *pre-run* gate (must
  // dismiss to begin the engine) versus a casual re-read (just close).
  const [introIsPreRun, setIntroIsPreRun] = useState(false);

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
    // Auto-open the how-to-play intro the first time a student starts
    // a run. The flag persists across sessions; pressing "Start
    // playing" inside the modal sets it. Subsequent runs skip the
    // gate but Help on DeckSelect can re-open it.
    const seen =
      typeof window !== "undefined" &&
      window.localStorage.getItem("ff_survivors_intro_seen") === "1";
    setIntroOpen(!seen);
    setIntroIsPreRun(!seen);
    setScreen("playing");
  };

  const dismissIntro = () => {
    try {
      window.localStorage.setItem("ff_survivors_intro_seen", "1");
    } catch {
      // Private mode etc. — losing the persistence is fine; the worst
      // case is the student sees the intro again next time.
    }
    setIntroOpen(false);
    // If this was the pre-run gate, the engine was paused on boot —
    // resume it now so the field starts ticking.
    if (introIsPreRun) engineRef.current?.resume();
    setIntroIsPreRun(false);
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
        else if (event.type === "stats") {
          // Cache the latest snapshot so the pause screen has live
          // numbers when it opens, even though it doesn't subscribe
          // directly.
          setLatestPlayer(event.player);
          setLatestWeapons(event.weapons);
        }
        else if (event.type === "levelUp") setLevelUp(event.choices);
        else if (event.type === "gameOver") {
          setGameOver(event.summary);
          void recordRun(event.summary);
          setScreen("gameover");
        }
      });

      await engine.start();
      // If the how-to-play modal is gating the run (first-time
      // students, or anyone whose localStorage flag is unset),
      // freeze the engine until they dismiss the intro. We re-read
      // localStorage rather than depending on the React state so
      // the effect's deps stay stable — no need to remount the
      // engine when the modal closes.
      if (cancelled) return;
      const seen =
        typeof window !== "undefined" &&
        window.localStorage.getItem("ff_survivors_intro_seen") === "1";
      if (!seen) engine.pause();
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

  // Pause / resume helpers + Esc/P keyboard shortcut.
  const openPause = () => {
    if (!engineRef.current || levelUp || gameOver) return;
    engineRef.current.pause();
    setPaused(true);
  };
  const closePause = () => {
    if (!engineRef.current) return;
    engineRef.current.resume();
    setPaused(false);
  };
  useEffect(() => {
    if (screen !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      // "P" is a perfectly normal letter in the typing input — if we
      // pause the moment a student types it, words like "preposition"
      // become impossible. So P only counts as a pause shortcut when
      // focus isn't sitting in an editable field. Esc is fine to keep
      // global because it's never a typed character.
      const target = e.target as HTMLElement | null;
      const inEditable = !!(
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      );
      const isPauseKey =
        e.key === "Escape" || (e.key.toLowerCase() === "p" && !inEditable);
      if (!isPauseKey) return;
      // Don't intercept Esc while the level-up modal is open — it
      // has its own number-key handler and the modal isn't dismissible
      // by Esc per spec (player must pick an upgrade). Likewise when
      // the how-to-play intro is open: its own handler treats Esc
      // as "start playing" (pre-run) or "close" (re-read), so we
      // mustn't also pause underneath it.
      if (levelUp || gameOver || introOpen) return;
      e.preventDefault();
      if (paused) closePause();
      else openPause();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, levelUp, gameOver, paused, introOpen]);

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

  // Playing or gameover — the canvas stays mounted underneath. The
  // canvas itself paints the theme's body colour each frame (see
  // GameEngine.render), so the wrapper just needs to sit black-bg-free
  // and let it through.
  const weaponCap =
    applyMasteryEffects(mastery?.unlockedNodes ?? []).weaponCap;
  return (
    <div className="fixed inset-0 z-40 bg-cream text-ink-900 dark:text-dark-ink">
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
            // Position is set inline because it changes every frame; the
            // visual styling sits in className so the label adopts the
            // theme palette. maxWidth uses `min()` so on phones the
            // label can't exceed 55% of viewport (avoids two adjacent
            // labels overlapping into illegible chaos), while on iPad /
            // desktop it stretches to a comfortable 240px.
            style={{
              position: "absolute",
              left: e.pos.x,
              top: e.pos.y + e.size * 0.5 + 6,
              transform: "translate(-50%, 0)",
              maxWidth: "min(240px, 55vw)",
            }}
            className="pointer-events-none whitespace-normal break-words rounded px-1.5 py-0.5 text-center text-[11px] leading-tight bg-surface/85 text-ink-900 shadow-sm dark:text-dark-ink"
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
          onPause={openPause}
        />
      )}

      {introOpen && runConfig && (
        <HowToPlayModal
          inputMode={runConfig.inputMode}
          isPreRun={introIsPreRun}
          onStart={dismissIntro}
          onClose={dismissIntro}
        />
      )}

      {paused && engineRef.current && latestPlayer && (
        <PauseScreen
          engine={engineRef.current}
          player={latestPlayer}
          weapons={latestWeapons}
          onResume={closePause}
          onQuit={() => {
            closePause();
            engineRef.current?.quit();
          }}
        />
      )}

      {/* Typing input is Keyboard-mode-only. An earlier version mounted
          it in Tap mode too so a desk player with a Bluetooth keyboard
          could type, but that meant iPadOS popped the on-screen
          keyboard up the moment a Tap-mode run started — the exact
          behaviour Tap mode exists to avoid. The user picks input mode
          on the menu; we honour it strictly. */}
      {/* While the intro modal is the pre-run gate, don't mount the
          input UIs — TypingInput autofocuses on mount, which would
          steal keystrokes the student means for the modal's Enter
          shortcut, and on iPadOS would pop up the on-screen keyboard
          before they've even started. */}
      {runConfig?.inputMode === "keyboard" && engineRef.current && !introOpen && (
        <TypingInput engine={engineRef.current} />
      )}
      {runConfig?.inputMode === "tap" && inputRef.current?.id === "tap" && engineRef.current && !introOpen && (
        <TapChoiceTray engine={engineRef.current} input={inputRef.current as TapInput} />
      )}

      {levelUp && engineRef.current && latestPlayer && (
        <LevelUpModal
          engine={engineRef.current}
          choices={levelUp}
          player={latestPlayer}
          weapons={latestWeapons}
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
