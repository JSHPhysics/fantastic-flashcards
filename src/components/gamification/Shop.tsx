// Shop modal. Three tabs (Themes / Fonts / Codes) plus a sticky coin
// balance at the top. Each item shows a swatch / sample, its name, and
// either "Owned", a cost, or "Locked — code only" depending on category.
//
// Purchase flow:
//  1. Tap a locked-for-purchase item -> confirm dialog -> spendCoins +
//     unlockTheme (or font). Insufficient coins surfaces a friendly
//     message instead of the buy button.
//  2. Free / owned items: tap to apply.

import { useState } from "react";
import { Dialog } from "../Dialog";
import { Button } from "../Button";
import { CoinBalance } from "./CoinBalance";
import {
  DEFAULT_LIGHT,
  DEFAULT_DARK,
  FREE_THEMES,
  PURCHASABLE_THEMES,
  SUBJECT_THEMES,
  isOwned,
  type ThemeDefinition,
} from "../../themes/catalogue";
import { FONTS, isFontOwned, type FontDefinition } from "../../themes/fonts";
import { useProfile, updateSettings } from "../../db";
import { spendCoins, currentBalance } from "../../gamification/coins";
import { redeemCode, listAllCodes, type RedeemResult } from "../../gamification/codes";

type Tab = "themes" | "fonts" | "codes";

interface ShopProps {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
}

export function Shop({ open, onClose, initialTab = "themes" }: ShopProps) {
  const [tab, setTab] = useState<Tab>(initialTab);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Theme & font shop"
      description="Pick a look you'll enjoy revising in. Some themes and fonts cost coins; others unlock with a code from your teacher."
      footer={
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CoinBalance showRemaining />
          <div role="tablist" className="flex gap-1">
            <TabButton active={tab === "themes"} onClick={() => setTab("themes")}>
              Themes
            </TabButton>
            <TabButton active={tab === "fonts"} onClick={() => setTab("fonts")}>
              Fonts
            </TabButton>
            <TabButton active={tab === "codes"} onClick={() => setTab("codes")}>
              Codes
            </TabButton>
          </div>
        </div>

        {tab === "themes" && <ThemesTab />}
        {tab === "fonts" && <FontsTab />}
        {tab === "codes" && <CodesTab />}
      </div>
    </Dialog>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`tap-target whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors ${
        active
          ? "bg-navy text-cream"
          : "bg-ink-100 text-ink-700 hover:bg-ink-100/70 dark:bg-dark-surface dark:text-ink-300"
      }`}
    >
      {children}
    </button>
  );
}

// ---- Themes tab ----

function ThemesTab() {
  const profile = useProfile();
  const unlocked = profile?.settings.unlockedThemes ?? [];
  const activeId =
    profile?.settings.themeId ??
    (profile?.settings.themeMode === "dark" ? "default-dark" : "default-light");

  // Subject themes are hidden until at least one is unlocked, so the shop
  // doesn't reveal them by default.
  const visibleSubject = SUBJECT_THEMES.filter((t) => unlocked.includes(t.id));

  return (
    <div className="space-y-4">
      <ThemeSection title="Default" items={[DEFAULT_LIGHT, DEFAULT_DARK]} activeId={activeId} />
      <ThemeSection title="Free" items={FREE_THEMES} activeId={activeId} />
      <ThemeSection title="Purchasable" items={PURCHASABLE_THEMES} activeId={activeId} />
      {visibleSubject.length > 0 && (
        <ThemeSection title="Subject teams" items={visibleSubject} activeId={activeId} />
      )}
    </div>
  );
}

function ThemeSection({
  title,
  items,
  activeId,
}: {
  title: string;
  items: ThemeDefinition[];
  activeId: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-300">
        {title}
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((theme) => (
          <li key={theme.id}>
            <ThemeRow theme={theme} active={theme.id === activeId} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ThemeRow({ theme, active }: { theme: ThemeDefinition; active: boolean }) {
  const profile = useProfile();
  const owned = isOwned(theme, profile?.settings.unlockedThemes);
  const balance = currentBalance(profile?.settings);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    if (theme.id === "default-light" || theme.id === "default-dark") {
      await updateSettings({
        themeId: undefined,
        themeMode: theme.id === "default-dark" ? "dark" : "light",
      });
    } else {
      await updateSettings({ themeId: theme.id });
    }
  };

  const handleClick = async () => {
    setError(null);
    if (owned) {
      setBusy(true);
      try {
        await apply();
      } finally {
        setBusy(false);
      }
      return;
    }
    if (theme.category === "subject") {
      setError("Unlock with a code from the Codes tab.");
      return;
    }
    // Purchasable.
    if (balance < theme.cost) {
      setError(`You need ${theme.cost - balance} more coin${theme.cost - balance === 1 ? "" : "s"}.`);
      return;
    }
    setConfirmOpen(true);
  };

  const confirmPurchase = async () => {
    setBusy(true);
    try {
      const spend = await spendCoins(theme.cost);
      if (!spend.ok) {
        setError("Not enough coins.");
        return;
      }
      const merged = new Set([
        ...(profile?.settings.unlockedThemes ?? []),
        theme.id,
      ]);
      await updateSettings({
        unlockedThemes: Array.from(merged),
        themeId: theme.id,
      });
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
          active
            ? "border-navy bg-navy/5 dark:border-gold dark:bg-gold/10"
            : "border-ink-100 hover:bg-ink-100/40 dark:border-dark-surface dark:hover:bg-dark-surface/70"
        }`}
      >
        <span className="flex gap-1" aria-hidden>
          {theme.swatches.map((s, i) => (
            <span
              key={i}
              className="h-7 w-3 rounded-sm"
              style={{ backgroundColor: s }}
            />
          ))}
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-sm font-medium text-ink-900 dark:text-dark-ink">
            {theme.name}
          </span>
          <span className="text-xs text-ink-500 dark:text-ink-300">
            {labelForState(theme, owned, active)}
          </span>
          {error && <span className="mt-1 text-xs text-again">{error}</span>}
        </span>
        {active && (
          <span className="text-xs font-semibold uppercase tracking-wider text-navy dark:text-gold">
            On
          </span>
        )}
      </button>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Unlock ${theme.name}?`}
        description={`Spends ${theme.cost} coin${theme.cost === 1 ? "" : "s"}. You'll have ${balance - theme.cost} left.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirmPurchase} disabled={busy}>
              {busy ? "Unlocking..." : "Unlock"}
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-3">
          <span className="flex gap-1" aria-hidden>
            {theme.swatches.map((s, i) => (
              <span
                key={i}
                className="h-10 w-4 rounded-sm"
                style={{ backgroundColor: s }}
              />
            ))}
          </span>
          <span className="text-sm text-ink-700 dark:text-ink-300">
            Apply automatically once unlocked.
          </span>
        </div>
      </Dialog>
    </>
  );
}

function labelForState(theme: ThemeDefinition, owned: boolean, active: boolean): string {
  if (active) return "Currently selected";
  if (owned) {
    return theme.cost === 0 ? "Free" : "Owned — tap to apply";
  }
  if (theme.category === "subject") return "Code required";
  return `${theme.cost} coins`;
}

// ---- Fonts tab ----

function FontsTab() {
  const profile = useProfile();
  const activeFontId = profile?.settings.fontId ?? "system";
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {FONTS.map((font) => (
        <li key={font.id}>
          <FontRow font={font} active={font.id === activeFontId} />
        </li>
      ))}
    </ul>
  );
}

function FontRow({ font, active }: { font: FontDefinition; active: boolean }) {
  const profile = useProfile();
  const owned = isFontOwned(font, profile?.settings.unlockedFonts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    if (!owned) {
      setError("Unlock with a code from the Codes tab.");
      return;
    }
    setBusy(true);
    try {
      await updateSettings({ fontId: font.id === "system" ? undefined : font.id });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`flex w-full flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors ${
        active
          ? "border-navy bg-navy/5 dark:border-gold dark:bg-gold/10"
          : "border-ink-100 hover:bg-ink-100/40 dark:border-dark-surface dark:hover:bg-dark-surface/70"
      }`}
    >
      <span
        className="text-lg text-ink-900 dark:text-dark-ink"
        style={{ fontFamily: font.stack }}
      >
        {font.name}
      </span>
      <span className="text-xs text-ink-500 dark:text-ink-300">
        {!owned ? "Code required" : active ? "Currently selected" : font.description}
      </span>
      {error && <span className="text-xs text-again">{error}</span>}
    </button>
  );
}

// ---- Codes tab ----

function CodesTab() {
  const profile = useProfile();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [showStaffRoom, setShowStaffRoom] = useState(false);
  const history = profile?.settings.unlockedCodes ?? [];

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await redeemCode(input);
      setResult(r);
      if (r.success) {
        setInput("");
        if (r.openStaffRoom) setShowStaffRoom(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-700 dark:text-ink-300">
        Have a code from your teacher? Enter it below to unlock themes or
        fonts.
      </p>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="ENTER CODE"
          spellCheck={false}
          autoCapitalize="characters"
          autoCorrect="off"
          className="flex-1 rounded-xl border border-ink-300 bg-surface px-3 py-2 text-base font-mono uppercase tracking-wider text-ink-900 placeholder:text-ink-500 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/30 dark:border-dark-surface dark:bg-dark-bg dark:text-dark-ink"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <Button onClick={submit} disabled={busy || !input.trim()}>
          {busy ? "..." : "Redeem"}
        </Button>
      </div>
      {result && (
        <p
          className={`text-sm ${
            result.success ? "text-good" : "text-again"
          }`}
          role="status"
        >
          {result.success
            ? result.alreadyRedeemed
              ? "You've already redeemed that one. (No worries — nothing changed.)"
              : `Redeemed: ${result.description ?? "unlocked"}.`
            : result.error}
        </p>
      )}

      {showStaffRoom && (
        <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm">
          <p className="font-medium text-navy dark:text-gold">Staff room</p>
          <p className="mt-1 text-xs text-ink-700 dark:text-ink-300">
            Full code reference. Hand these out to students at your discretion.
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
            {listAllCodes().map((c) => (
              <li key={c.code} className="flex items-center justify-between gap-2">
                <code className="font-mono text-ink-900 dark:text-dark-ink">{c.code}</code>
                <span className="text-ink-500 dark:text-ink-300">{c.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
            Codes you've redeemed
          </p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {history.map((c) => (
              <li
                key={c}
                className="rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[11px] text-ink-700 dark:bg-dark-surface dark:text-ink-300"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
