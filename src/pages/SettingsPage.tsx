import { useEffect, useState } from "react";
import { PagePlaceholder } from "./PagePlaceholder";
import {
  totalMediaBytes,
  updateSettings,
  useProfile,
  type ProfileSettings,
} from "../db";
import { useVoices, hasSpeechSynthesis } from "../tts/useVoices";

export function SettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      subtitle="Theme, audio, daily limits, backup. Backup buttons arrive in Session 13."
    >
      <div className="space-y-4">
        <AudioToggles />
        <TtsExplainer />
        <VoiceInspector />
        <StorageInfo />
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
        Auto-play behaviour during study sessions.
      </p>
      <div className="mt-3 space-y-2">
        <Toggle
          label="Auto-play recorded audio on show"
          checked={s.audioAutoplayOnShow}
          onChange={(v) => set({ audioAutoplayOnShow: v })}
        />
        <Toggle
          label="Auto-play recorded audio on reveal"
          checked={s.audioAutoplayOnReveal}
          onChange={(v) => set({ audioAutoplayOnReveal: v })}
        />
        <Toggle
          label="Auto-speak text on show"
          checked={s.ttsAutoplayOnShow}
          onChange={(v) => set({ ttsAutoplayOnShow: v })}
        />
        <Toggle
          label="Auto-speak text on reveal"
          checked={s.ttsAutoplayOnReveal}
          onChange={(v) => set({ ttsAutoplayOnReveal: v })}
        />
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
        Pronunciation uses voices installed on this device. On iPad / iPhone, go
        to Settings → Accessibility → Spoken Content → Voices and download
        Enhanced voices for any language you're studying. On Windows, install
        additional speech packs via Settings → Time & language → Speech.
      </p>
      <p className="mt-2">
        If a speaker icon plays a flat or robotic voice, that just means the
        Enhanced voice for that language isn't installed yet.
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
          This browser doesn't expose Speech Synthesis. Pronunciation will be
          unavailable.
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
          Voice list still loading; pull-to-refresh or open a card with a
          language set to trigger a load.
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
