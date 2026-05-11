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

export function SettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      subtitle="Audio, pronunciation, storage. Backup options are coming soon."
    >
      <div className="space-y-4">
        <AudioToggles />
        <TtsExplainer />
        <VoiceInspector />
        <StorageInfo />
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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      </dl>
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
                Adds four practice decks (French, Spanish, and German vocab,
                plus one with a sample of every card type). Each is prefixed
                with "[debug]" so you can spot them. Won't duplicate
                anything that's already there.
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
