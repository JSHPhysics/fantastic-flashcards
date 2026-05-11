import { PagePlaceholder } from "./PagePlaceholder";

export function SettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      subtitle="Theme, audio, daily limits, backup. Backup buttons arrive in Session 13."
    >
      <div className="card-surface p-6 text-sm text-ink-700 dark:text-ink-300">
        <p className="font-medium text-ink-900 dark:text-dark-ink">Privacy</p>
        <p className="mt-1">
          All data is stored on this device only. No accounts, no telemetry, no
          network calls you didn't initiate.
        </p>
      </div>
    </PagePlaceholder>
  );
}
