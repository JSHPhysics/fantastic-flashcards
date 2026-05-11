// Read-only display for a drawing card. Used by the deck preview and by the
// review session (Session 10) when the student taps "Show answer". The
// student-drawing canvas itself is a separate component that lives in the
// review flow; this one just renders the stored model answer image, with
// the optional background diagram beneath it.
//
// reveal mode handling (overlay vs side-by-side vs toggle) is the caller's
// concern: the review session decides which DrawingRenderer instances to
// mount and how to lay them out.

import type { DrawingContent } from "../../../db";
import { useObjectUrl } from "../../../media/useObjectUrl";

export function DrawingRenderer({
  content,
  showModel,
  emptyOverlay,
}: {
  content: DrawingContent;
  // false = render only the background (or nothing if no background); the
  // model answer image is hidden. true = render background plus the model
  // answer on top.
  showModel: boolean;
  // Optional ReactNode rendered on top of everything (used by the review
  // session to layer the student's live Konva canvas above this renderer
  // in "toggle" mode).
  emptyOverlay?: React.ReactNode;
}) {
  const backgroundUrl = useObjectUrl(content.backgroundImageHash);
  const modelUrl = useObjectUrl(content.modelAnswerImageHash);

  return (
    <div className="relative inline-block">
      {backgroundUrl && (
        <img
          src={backgroundUrl}
          alt=""
          className="block max-h-[60vh] w-auto"
          draggable={false}
        />
      )}
      {!backgroundUrl && !modelUrl && (
        <div className="card-surface flex h-48 w-80 items-center justify-center text-sm text-ink-500">
          Loading...
        </div>
      )}
      {modelUrl && (
        <img
          src={modelUrl}
          alt=""
          className="absolute inset-0 block max-h-[60vh] w-auto transition-opacity duration-200"
          style={{ opacity: showModel ? 1 : 0 }}
          draggable={false}
        />
      )}
      {emptyOverlay && (
        <div className="absolute inset-0">{emptyOverlay}</div>
      )}
    </div>
  );
}
