import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteDeck,
  duplicateDeck,
  type Deck,
} from "../db";
import { RenameDeckDialog } from "./RenameDeckDialog";
import { MoveDeckDialog } from "./MoveDeckDialog";
import { ConfirmDialog } from "./ConfirmDialog";

export function DeckActionsMenu({ deck }: { deck: Deck }) {
  const [open, setOpen] = useState(false);
  // "down" or "up" — flipped when the button is too close to the bottom of
  // the viewport, so the menu doesn't slip under the FAB or off-screen.
  const [direction, setDirection] = useState<"down" | "up">("down");
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Decide which way the menu should open. We measure the button's position
  // on every open so a scrolled page doesn't cache a stale choice. ~240px
  // covers the five menu items + padding. If there's less than that below
  // the button (e.g. the bottom-most deck row with the FAB nearby) the menu
  // flips upward.
  const handleOpen = () => {
    const button = buttonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDirection(spaceBelow < 240 ? "up" : "down");
    }
    setOpen((v) => !v);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Actions for deck ${deck.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleOpen();
        }}
        className="tap-target inline-flex items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-dark-surface dark:hover:text-dark-ink"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-30 w-48 overflow-hidden rounded-xl border border-ink-100 bg-surface shadow-lg dark:border-dark-surface dark:bg-dark-surface ${
            direction === "up" ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <MenuItem
            onClick={() => {
              setOpen(false);
              setRenameOpen(true);
            }}
          >
            Rename
          </MenuItem>
          <MenuItem
            onClick={() => {
              setOpen(false);
              navigate(`/decks/${deck.id}/edit`);
            }}
          >
            Edit
          </MenuItem>
          <MenuItem
            onClick={async () => {
              setOpen(false);
              await duplicateDeck(deck.id, deck.parentId);
            }}
          >
            Duplicate
          </MenuItem>
          <MenuItem
            onClick={() => {
              setOpen(false);
              setMoveOpen(true);
            }}
          >
            Move
          </MenuItem>
          <MenuItem
            danger
            onClick={() => {
              setOpen(false);
              setDeleteOpen(true);
            }}
          >
            Delete
          </MenuItem>
        </div>
      )}

      <RenameDeckDialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        deck={deck}
      />
      <MoveDeckDialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        movingDeckId={deck.id}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteDeck(deck.id)}
        title={`Delete "${deck.name}"?`}
        description={
          deck.descendantCardCount > 0
            ? `This deletes ${deck.descendantCardCount} card${
                deck.descendantCardCount === 1 ? "" : "s"
              } and any sub-decks. It can't be undone.`
            : "This can't be undone."
        }
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-ink-100 dark:hover:bg-dark-bg ${
        danger
          ? "text-again"
          : "text-ink-900 dark:text-dark-ink"
      }`}
    >
      {children}
    </button>
  );
}
