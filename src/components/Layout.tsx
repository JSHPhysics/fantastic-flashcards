import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const tabs: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/", label: "Home", icon: <HomeIcon /> },
  { to: "/stats", label: "Stats", icon: <StatsIcon /> },
  { to: "/settings", label: "Settings", icon: <SettingsIcon /> },
];

export function Layout({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  // Hide tab nav while studying to keep the surface uncluttered
  const hideTabs = pathname.startsWith("/study");

  return (
    <div className="flex min-h-full flex-col bg-cream text-ink-900 dark:bg-dark-bg dark:text-dark-ink">
      <TopBar />
      <main
        className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-4 sm:px-6"
        id="main-content"
      >
        {children ?? <Outlet />}
      </main>
      {!hideTabs && <BottomTabs />}
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-100 bg-cream/85 backdrop-blur dark:border-dark-surface dark:bg-dark-bg/85">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
        <NavLink
          to="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
          aria-label="Fantastic Flashcards home"
        >
          <span
            aria-hidden
            className="inline-block h-6 w-6 rounded-md bg-navy"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #1E3A5F 0%, #1E3A5F 55%, #C9A14A 55%, #C9A14A 100%)",
            }}
          />
          <span>Fantastic Flashcards</span>
        </NavLink>
      </div>
    </header>
  );
}

function BottomTabs() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-dark-surface dark:bg-dark-bg/95"
    >
      <ul className="mx-auto flex w-full max-w-4xl">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === "/"}
              className={({ isActive }) =>
                [
                  "tap-target flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  isActive
                    ? "text-navy dark:text-gold"
                    : "text-ink-500 hover:text-ink-700 dark:text-ink-300 dark:hover:text-dark-ink",
                ].join(" ")
              }
            >
              <span aria-hidden className="h-6 w-6">
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden>
      <path
        d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden>
      <path
        d="M4 20V10m6 10V4m6 16v-7m6 7V8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M19.4 15a7.97 7.97 0 0 0 .1-3l2-1.5-2-3.4-2.3.7a8 8 0 0 0-2.6-1.5L14 3.5h-4l-.6 2.8a8 8 0 0 0-2.6 1.5l-2.3-.7-2 3.4 2 1.5a7.97 7.97 0 0 0 .1 3l-2 1.5 2 3.4 2.3-.7a8 8 0 0 0 2.6 1.5l.6 2.8h4l.6-2.8a8 8 0 0 0 2.6-1.5l2.3.7 2-3.4-2-1.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
