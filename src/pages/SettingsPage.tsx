import { useEffect, useState } from "react";
import { PagePlaceholder } from "./PagePlaceholder";
import { totalMediaBytes } from "../db";

export function SettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      subtitle="Theme, audio, daily limits, backup. Backup buttons arrive in Session 13."
    >
      <div className="space-y-4">
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
