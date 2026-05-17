import { useEffect, useState } from "react";
import { PagePlaceholder } from "./PagePlaceholder";
import {
  seedDebugData,
  totalMediaBytes,
  updateSettings,
  useProfile,
  wipeAllData,
  type ProfileSettings,
} from "../db";
import { useVoices, hasSpeechSynthesis } from "../tts/useVoices";
import { getLastOnlineSpeechError } from "../tts/online";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { BackupSection } from "../components/BackupSection";
import { CoinBalance } from "../components/gamification/CoinBalance";
import { RankUpDialog } from "../components/gamification/RankUpDialog";
import { useShop } from "../components/Layout";
import { getTheme } from "../themes/catalogue";
import { getFont } from "../themes/fonts";
import { db } from "../db/schema";
import {
  awardCoinsForReview,
  awardDeckCompleteBonus,
  setCoinBalance,
} from "../gamification/coins";
import { RANKS, type RankInfo } from "../gamification/ranks";

export function SettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      subtitle="Audio, pronunciation, storage. Backup options are coming soon."
    >
      <div className="space-y-4">
        <AppearanceSection />
        <BackupSection />
        <AudioToggles />
        <TtsExplainer />
        <VoiceInspector />
        <StorageInfo />
        <AboutCard />
        <DebugPanel />
        <div className="card-surface p-6 text-sm text-ink-700 dark:text-ink-300">
          <p className="font-medium text-ink-900 dark:text-dark-ink">Privacy</p>
          <p className="mt-1">
            All data is stored on this device only. No accounts, no telemetry,
            no network calls you didn't initiate.
          </p>
        </div>
      </div>
    </PagePlaceholder>
  );
}

function AppearanceSection() {
  const profile = useProfile();
  const shop = useShop();
  if (!profile) return null;
  const themeId =
    profile.settings.themeId ??
    (profile.settings.themeMode === "dark" ? "default-dark" : "default-light");
  const themeName = getTheme(themeId)?.name ?? "Default light";
  const fontName =
    getFont(profile.settings.fontId)?.name ?? "System UI";

  return (
    <div className="card-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink-900 dark:text-dark-ink">
            Look &amp; feel
          </p>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
            Currently using {themeName} · {fontName}. Tap the coin pill at the
            top of any page to open the shop too.
          </p>
        </div>
        <CoinBalance showRemaining />
      </div>
      <div className="mt-3">
        <Button onClick={shop.open}>Open theme &amp; font shop</Button>
      </div>
    </div>
  );
}

function AudioToggles() {
  const profile = useProfile();
  if (!profile) return null;
  const s = profile.settings;

  const set = (patch: Partial<ProfileSettings>) => {
    void updateSettings(patch);
  };

  return (
    <div className="card-surface p-6">
      <p className="font-medium text-ink-900 dark:text-dark-ink">Audio</p>
      <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
        What plays automatically during a study session.
      </p>
      <div className="mt-3 space-y-2">
        <Toggle
          label="Play recorded audio when a card appears"
          checked={s.audioAutoplayOnShow}
          onChange={(v) => set({ audioAutoplayOnShow: v })}
        />
        <Toggle
          label="Play recorded audio when the answer is revealed"
          checked={s.audioAutoplayOnReveal}
          onChange={(v) => set({ audioAutoplayOnReveal: v })}
        />
        <Toggle
          label="Speak card text when a card appears"
          checked={s.ttsAutoplayOnShow}
          onChange={(v) => set({ ttsAutoplayOnShow: v })}
        />
        <Toggle
          label="Speak card text when the answer is revealed"
          checked={s.ttsAutoplayOnReveal}
          onChange={(v) => set({ ttsAutoplayOnReveal: v })}
        />
      </div>
      <div className="mt-4 rounded-xl border border-ink-100 bg-cream/40 p-3 dark:border-dark-surface dark:bg-dark-bg/40">
        <Toggle
          label="Use Google's online voices for pronunciation"
          checked={s.useOnlineVoices ?? false}
          onChange={(v) => set({ useOnlineVoices: v })}
        />
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-300">
          Speaker icons will use Google's voice for any language, no voice
          downloads needed. The card text gets sent to Google with each tap,
          so internet is required. If you go offline, the app falls back to
          whatever voices your device has installed. Off by default.
        </p>
      </div>
    </div>
  );
}

function TtsExplainer() {
  return (
    <div className="card-surface p-6 text-sm text-ink-700 dark:text-ink-300">
      <p className="font-medium text-ink-900 dark:text-dark-ink">
        Voice quality
      </p>
      <p className="mt-1">
        Pronunciation normally uses voices installed on this device. On iPad
        and iPhone, go to Settings → Accessibility → Spoken Content → Voices
        and download an Enhanced voice for any language you're studying. On
        Windows, additional speech packs are at Settings → Time & language →
        Speech.
      </p>
      <p className="mt-2">
        If a speaker icon sounds robotic or thin, the device just doesn't have
        a good voice for that language. Either install one as above, or turn
        on "Use Google's online voices" to skip the install entirely.
      </p>
    </div>
  );
}

function VoiceInspector() {
  const voices = useVoices();
  if (!hasSpeechSynthesis()) {
    return (
      <div className="card-surface p-6 text-sm text-ink-700 dark:text-ink-300">
        <p className="font-medium text-ink-900 dark:text-dark-ink">
          Installed voices
        </p>
        <p className="mt-1">
          Your browser doesn't support text-to-speech. The speaker icons
          won't work unless you turn on Google's online voices above.
        </p>
      </div>
    );
  }
  // Group by primary subtag for readability.
  const grouped = new Map<string, SpeechSynthesisVoice[]>();
  for (const v of voices) {
    const sub = v.lang.split("-")[0].toLowerCase();
    const list = grouped.get(sub) ?? [];
    list.push(v);
    grouped.set(sub, list);
  }
  const sortedKeys = [...grouped.keys()].sort();

  return (
    <details className="card-surface group p-6">
      <summary className="cursor-pointer text-sm font-medium text-ink-900 dark:text-dark-ink">
        Installed voices ({voices.length})
      </summary>
      {voices.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500 dark:text-ink-300">
          Voices are still loading. Open a card with a language set if they
          haven't appeared after a moment.
        </p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm">
          {sortedKeys.map((sub) => (
            <li key={sub}>
              <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
                {sub}
              </p>
              <ul className="mt-1 space-y-0.5 pl-2">
                {grouped.get(sub)!.map((v) => (
                  <li key={`${v.name}-${v.lang}`} className="text-ink-700 dark:text-ink-300">
                    {v.name}{" "}
                    <span className="text-ink-500">
                      ({v.lang}
                      {v.default ? ", default" : ""}
                      {v.localService ? "" : ", remote"})
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function StorageInfo() {
  const [mediaBytes, setMediaBytes] = useState<number | null>(null);
  const [quota, setQuota] = useState<StorageEstimate | null>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  // Tracks the outcome of the most recent persist() call so we can give the
  // user useful feedback when the browser silently refuses (Safari's
  // engagement-gated implementation never shows a prompt).
  const [requestOutcome, setRequestOutcome] = useState<
    null | "granted" | "denied" | "unsupported"
  >(null);
  const [requestBusy, setRequestBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bytes = await totalMediaBytes();
      if (cancelled) return;
      setMediaBytes(bytes);

      if (navigator.storage?.estimate) {
        try {
          const est = await navigator.storage.estimate();
          if (!cancelled) setQuota(est);
        } catch {
          // Some browsers reject estimate(); ignore.
        }
      }
      if (navigator.storage?.persisted) {
        try {
          const p = await navigator.storage.persisted();
          if (!cancelled) setPersistent(p);
        } catch {
          // Browsers without persisted() will leave the indicator as "Unknown".
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const askForPersist = async () => {
    if (!navigator.storage?.persist) {
      setRequestOutcome("unsupported");
      return;
    }
    setRequestBusy(true);
    try {
      const granted = await navigator.storage.persist();
      setPersistent(granted);
      setRequestOutcome(granted ? "granted" : "denied");
    } catch {
      setRequestOutcome("denied");
    } finally {
      setRequestBusy(false);
    }
  };

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // Safari iOS legacy
      (navigator as Navigator & { standalone?: boolean }).standalone === true);

  return (
    <div className="card-surface p-6 text-sm">
      <p className="font-medium text-ink-900 dark:text-dark-ink">Storage</p>
      <dl className="mt-2 grid gap-1 text-ink-700 dark:text-ink-300">
        <Row
          label="Media on device"
          value={mediaBytes === null ? "..." : formatBytes(mediaBytes)}
        />
        {quota?.usage !== undefined && (
          <Row label="Used by this site" value={formatBytes(quota.usage)} />
        )}
        {quota?.quota !== undefined && (
          <Row label="Available quota" value={formatBytes(quota.quota)} />
        )}
        <Row
          label="Persistent"
          value={
            persistent === null
              ? "Unknown"
              : persistent
                ? "Yes - browser won't auto-clear"
                : "No - browser may clear when low on space"
          }
        />
      </dl>
      {persistent === false && Boolean(navigator.storage?.persist) && (
        <div className="mt-2 space-y-1 text-xs text-ink-500 dark:text-ink-300">
          <p>
            Safari and Chrome decide this automatically based on how often
            you open the app. Adding it to the home screen and using it on
            a couple of separate days usually flips it to Yes.
          </p>
          {!isStandalone && (
            <p>
              Open from the home-screen icon (not the Safari tab) to give
              the browser the strongest signal.
            </p>
          )}
          <button
            type="button"
            onClick={askForPersist}
            disabled={requestBusy}
            className="text-navy underline dark:text-gold"
          >
            {requestBusy ? "Asking..." : "Ask now"}
          </button>
          {requestOutcome === "granted" && (
            <p className="text-good">
              Granted. Your data won't be auto-cleared.
            </p>
          )}
          {requestOutcome === "denied" && (
            <p>
              The browser didn't grant it this time. Keep using the app —
              most browsers grant it after a few sessions, no action needed.
            </p>
          )}
          {requestOutcome === "unsupported" && (
            <p>This browser doesn't support persistent storage requests.</p>
          )}
        </div>
      )}
    </div>
  );
}

function AboutCard() {
  // Branch + short SHA on one line — handy on a phone screen where every
  // row of vertical space matters, and the pair together is what you
  // compare against the latest commit when checking if a deploy went out.
  const buildLabel = `${__GIT_BRANCH__} · ${__GIT_SHA__}`;
  return (
    <div className="card-surface p-6 text-sm text-ink-700 dark:text-ink-300">
      <p className="font-medium text-ink-900 dark:text-dark-ink">About</p>
      <dl className="mt-2 grid gap-1">
        <Row label="App version" value={__APP_VERSION__} />
        <Row label="Build" value={buildLabel} />
        <Row label="Built" value={__BUILD_TIME__} />
      </dl>
      <p className="mt-2 text-xs">
        Built by Joshua Stafford-Haworth (JSHPhysics). Source on GitHub.
      </p>
    </div>
  );
}

function DebugPanel() {
  const profile = useProfile();
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  if (!profile) return null;

  const debugOn = profile.settings.debugMode ?? false;

  const handleSeed = async () => {
    setSeedMessage(null);
    setSeeding(true);
    try {
      const result = await seedDebugData();
      if (result.alreadySeeded) {
        setSeedMessage(
          "Sample decks are already there. Wipe local data first if you want a fresh set.",
        );
      } else {
        setSeedMessage(
          `Created ${result.decksCreated} sample decks with ${result.cardsCreated} cards (reverse cards counted in the total).`,
        );
      }
    } catch (err) {
      setSeedMessage(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="card-surface p-6">
      <p className="font-medium text-ink-900 dark:text-dark-ink">Debug</p>
      <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
        Tools for testing the app. Turn off to hide the wipe button when
        you're not using it.
      </p>
      <div className="mt-3 space-y-3">
        <Toggle
          label="Enable debug mode"
          checked={debugOn}
          onChange={(v) => updateSettings({ debugMode: v })}
        />
        {debugOn && (
          <>
            <div className="rounded-xl border border-ink-100 bg-cream/40 p-3 dark:border-dark-surface dark:bg-dark-bg/40">
              <p className="text-sm font-medium text-ink-900 dark:text-dark-ink">
                Sample decks
              </p>
              <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">
                Adds a demo set you can walk through with someone: a Languages
                deck with French, Spanish, and German sub-decks; a Physics
                A-level deck with Mechanics, Waves, and Electricity; a Biology
                GCSE deck with Cells and Genetics; a Card types showcase; and
                a Physics rapid-fire deck purpose-built for Flashcard
                Survivors (one-word answers, every card starts due). Each
                card has tags, and two weeks of made-up review history fills
                in the Stats screen. All deck names start with "[demo]" so
                they're easy to spot. Won't duplicate anything that's already
                there.
              </p>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  onClick={handleSeed}
                  disabled={seeding}
                >
                  {seeding ? "Seeding..." : "Generate sample decks"}
                </Button>
              </div>
              {seedMessage && (
                <p className="mt-2 text-xs text-ink-700 dark:text-ink-300">
                  {seedMessage}
                </p>
              )}
            </div>

            <OnlineTtsDiagnostic />

            <GamificationTestbench />

            <StorageInspector />

            <div className="rounded-xl border border-again/30 bg-again/5 p-3">
              <p className="text-sm font-medium text-again">Danger zone</p>
              <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">
                Deletes every deck, card, image, and recording on this
                device, then reloads. Cannot be undone — back up first if
                there's anything to keep.
              </p>
              <div className="mt-2">
                <Button variant="danger" onClick={() => setWipeOpen(true)}>
                  Wipe all local data
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={wipeOpen}
        onClose={() => setWipeOpen(false)}
        onConfirm={() => void wipeAllData()}
        title="Wipe everything on this device?"
        description="Every deck, card, image, recording, and study history on this device will be deleted. This cannot be undone."
        confirmLabel="Wipe everything"
        destructive
      />
    </div>
  );
}

// Quick-fire buttons for verifying the gamification flows on a deployed
// build where the COINMAX / RESETALL / DEBUGMODE codes alone aren't
// enough. Set a coin balance directly, force a rank-up popup at any
// tier, reset today's coin bucket, or simulate a card review to test the
// "+1 / +2 / cap at 25" logic without having to actually drill cards.
function GamificationTestbench() {
  const profile = useProfile();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [forcedRank, setForcedRank] = useState<RankInfo | null>(null);
  const [coinInput, setCoinInput] = useState("9999");
  const [pickedRankId, setPickedRankId] = useState<string>("recruit");

  if (!profile) return null;

  const run = async (label: string, fn: () => Promise<string | void>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await fn();
      setMessage(typeof r === "string" ? r : `${label} done.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-ink-100 bg-cream/40 p-3 dark:border-dark-surface dark:bg-dark-bg/40">
      <p className="text-sm font-medium text-ink-900 dark:text-dark-ink">
        Gamification testbench
      </p>
      <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">
        Quick-fire buttons for verifying the coin economy and rank popup
        without grinding cards. All actions write to the same profile
        gamification state as normal review, so behave like the real
        feature would.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-ink-100 p-2 dark:border-dark-surface">
          <p className="text-xs font-medium text-ink-900 dark:text-dark-ink">
            Coins
          </p>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">
            Current: {profile.settings.coins ?? 0}, today's total:{" "}
            {profile.settings.coinsToday?.total ?? 0}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() =>
                run("Award base + first-correct", async () => {
                  const r = await awardCoinsForReview({
                    cardId: `debug-${Date.now()}`,
                    rating: 3,
                  });
                  return `Awarded ${r.awarded} coin${r.awarded === 1 ? "" : "s"}. Total today: ${
                    profile.settings.coinsToday?.total ?? 0
                  } → balance ${r.balance}${r.reachedCap ? " (cap reached)" : ""}.`;
                })
              }
            >
              +1 review
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() =>
                run("Award deck-complete", async () => {
                  const r = await awardDeckCompleteBonus(`debug-deck-${Date.now()}`);
                  return `Deck-complete bonus: +${r.awarded}, balance ${r.balance}.`;
                })
              }
            >
              +5 deck-complete
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <input
              value={coinInput}
              onChange={(e) => setCoinInput(e.target.value)}
              inputMode="numeric"
              className="w-20 rounded-md border border-ink-300 bg-surface px-2 py-1 text-xs text-ink-900 dark:border-dark-surface dark:bg-dark-bg dark:text-dark-ink"
              autoComplete="off"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() =>
                run("Set balance", async () => {
                  const n = Math.max(0, Number(coinInput) || 0);
                  await setCoinBalance(n);
                  return `Balance set to ${n}.`;
                })
              }
            >
              Set balance
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                run("Reset today's bucket", async () => {
                  const p = await db.profile.get("self");
                  if (!p) return;
                  await db.profile.update("self", {
                    settings: { ...p.settings, coinsToday: undefined },
                  });
                  return "Today's coin bucket cleared.";
                })
              }
            >
              Reset today
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-ink-100 p-2 dark:border-dark-surface">
          <p className="text-xs font-medium text-ink-900 dark:text-dark-ink">
            Rank-up popup
          </p>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">
            Force the popup at any rank — confetti intensity matches the
            real flow.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <select
              value={pickedRankId}
              onChange={(e) => setPickedRankId(e.target.value)}
              className="rounded-md border border-ink-300 bg-surface px-2 py-1 text-xs text-ink-900 dark:border-dark-surface dark:bg-dark-bg dark:text-dark-ink"
            >
              {RANKS.filter((r) => r.id !== "unranked").map((r) => (
                <option key={r.id} value={r.id}>
                  {r.icon} {r.label}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => {
                const rank = RANKS.find((r) => r.id === pickedRankId);
                if (rank) setForcedRank(rank);
              }}
            >
              Show popup
            </Button>
          </div>
        </div>
      </div>

      {message && (
        <p className="mt-2 text-xs text-ink-700 dark:text-ink-300">{message}</p>
      )}

      <RankUpDialog rank={forcedRank} onClose={() => setForcedRank(null)} />
    </div>
  );
}

// Read-only snapshot of every Dexie table's row count + any media that's
// somehow lost its refCount (refCount <= 0 means the GC sweep should have
// reclaimed it). Saves users having to open DevTools on iPad where it's
// not really an option. Refresh button re-queries on demand.
function StorageInspector() {
  const [snapshot, setSnapshot] = useState<{
    decks: number;
    cards: number;
    media: number;
    reviews: number;
    sessions: number;
    orphanedMedia: number;
    suspendedCards: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [decks, cards, media, reviews, sessions, allMedia, allCards] =
        await Promise.all([
          db.decks.count(),
          db.cards.count(),
          db.media.count(),
          db.reviews.count(),
          db.sessions.count(),
          db.media.toArray(),
          db.cards.toArray(),
        ]);
      const orphanedMedia = allMedia.filter((m) => m.refCount <= 0).length;
      const suspendedCards = allCards.filter((c) => c.suspended).length;
      setSnapshot({
        decks,
        cards,
        media,
        reviews,
        sessions,
        orphanedMedia,
        suspendedCards,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="rounded-xl border border-ink-100 bg-cream/40 p-3 dark:border-dark-surface dark:bg-dark-bg/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-900 dark:text-dark-ink">
          Storage inspector
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="text-xs text-navy underline dark:text-gold"
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>
      <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">
        Row counts in each Dexie table on this device. Orphaned media is
        anything with refCount {"<="} 0 — should always be 0 after a sweep
        runs (next app launch).
      </p>
      {snapshot && (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <InspectorRow label="Decks" value={snapshot.decks} />
          <InspectorRow label="Cards" value={snapshot.cards} />
          <InspectorRow label="Media blobs" value={snapshot.media} />
          <InspectorRow label="Review events" value={snapshot.reviews} />
          <InspectorRow label="Sessions" value={snapshot.sessions} />
          <InspectorRow
            label="Suspended cards"
            value={snapshot.suspendedCards}
          />
          <InspectorRow
            label="Orphaned media"
            value={snapshot.orphanedMedia}
            danger={snapshot.orphanedMedia > 0}
          />
        </dl>
      )}
    </div>
  );
}

function InspectorRow({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <>
      <dt className="text-ink-700 dark:text-ink-300">{label}</dt>
      <dd
        className={`text-right font-medium ${
          danger ? "text-again" : "text-ink-900 dark:text-dark-ink"
        }`}
      >
        {value}
      </dd>
    </>
  );
}

function OnlineTtsDiagnostic() {
  // Poll the module-level lastError every 2s while debug is open. Cheap, and
  // saves us wiring a custom event bus.
  const [snapshot, setSnapshot] = useState(getLastOnlineSpeechError());
  useEffect(() => {
    const id = window.setInterval(() => {
      setSnapshot(getLastOnlineSpeechError());
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border border-ink-100 bg-cream/40 p-3 dark:border-dark-surface dark:bg-dark-bg/40">
      <p className="text-sm font-medium text-ink-900 dark:text-dark-ink">
        Last online TTS attempt
      </p>
      {!snapshot ? (
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">
          No errors recorded yet. If "Use Google's online voices" is on and
          a speaker icon plays the device's voice instead, the reason will
          appear here.
        </p>
      ) : (
        <>
          <p className="mt-0.5 break-all text-xs text-ink-700 dark:text-ink-300">
            URL: {snapshot.url}
          </p>
          <p className="mt-1 text-xs text-again">
            {snapshot.error instanceof Error
              ? `${snapshot.error.name}: ${snapshot.error.message}`
              : String(snapshot.error)}
          </p>
        </>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-ink-900 dark:text-dark-ink">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-navy"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt>{label}</dt>
      <dd className="font-medium text-ink-900 dark:text-dark-ink">{value}</dd>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}
