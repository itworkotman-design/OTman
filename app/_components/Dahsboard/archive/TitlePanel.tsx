"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { RichTextEditorField } from "@/app/_components/Dahsboard/RichTextEditorField";

export type TitlePanelHandle = {
  // Takes the section's real id as a call-time argument — same reasoning as
  // SpreadsheetPanelHandle.flushPendingChanges (a pending section has no
  // real id until Save's first phase creates it).
  flushPendingChanges: (sectionId: string) => Promise<void>;
};

type TitlePanelProps = {
  // `null` means a not-yet-created (pending) section — nothing to fetch yet,
  // starts from an empty title until a real id exists.
  sectionId: string | null;
  locale: string;
  onDirtyChange?: (dirty: boolean) => void;
};

// A single rich-text heading content section — the simplest of the four
// content-section types structurally (no list of fields like TextFieldsPanel,
// no grid like SpreadsheetPanel), just one line, but still formattable
// (bold/italic/color/alignment) via RichTextEditorField, always
// rendered large. Same deferred-save/dirty-snapshot shape as
// SpreadsheetPanel: nothing hits the network until the page-level Save
// button flushes it via flushPendingChanges.
export const TitlePanel = forwardRef<TitlePanelHandle, TitlePanelProps>(function TitlePanel(
  { sectionId, locale, onDirtyChange },
  ref,
) {
  const [text, setText] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!sectionId) {
      setText("");
      setSavedSnapshot("");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/archive/content-sections/${sectionId}/title`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok) {
        setText(body.text);
        setSavedSnapshot(body.text);
      } else {
        setError(body?.reason || "Failed to load title");
      }
    } catch {
      setError("Failed to load title");
    } finally {
      setLoading(false);
    }
  }

  // Tracks the `sectionId` this instance has actually loaded for —
  // `undefined` means never loaded. Reordering this section within
  // ContentSectionList's list (even via the plain up/down buttons, no
  // drag-and-drop involved) can make this effect re-run with `sectionId`
  // completely UNCHANGED — a keyed-list quirk that shows up reliably under
  // StrictMode (React re-associates this fiber's effect during the
  // reorder's reconciliation) though the component itself never remounts.
  // Comparing against the dependency array alone isn't enough to catch
  // that, since `[sectionId]` "changing" is exactly what React itself
  // fails to rule out here — so this checks the ACTUAL last-loaded id
  // instead, and skips entirely (no fetch, no reset-to-empty) whenever
  // it's unchanged, which is what a spurious re-run always looks like.
  //
  // The one legitimate case where `sectionId` truly changes without a
  // fetch being safe is the pending-section-just-got-created transition
  // (null -> real id), which ContentSectionList's Save triggers via
  // setSections BEFORE it calls flushPendingChanges (see that function's
  // own comment on why it takes the id as a call-time argument rather than
  // waiting on this prop). A section that was pending a moment ago can't
  // have any server-side text yet — refetching here would race
  // flushPendingChanges and can win, clobbering `text`/`savedSnapshot`
  // back to "" (making `dirty` false) right before the flush loop reads
  // it, silently dropping whatever was just typed. Adopting the new id
  // without a fetch keeps local state (and its dirty-ness) exactly as-is,
  // so the flush that's about to happen still sees it.
  const loadedForRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (loadedForRef.current === sectionId) return;
    const wasPending = loadedForRef.current === null;
    loadedForRef.current = sectionId;
    if (sectionId && wasPending) return;

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const dirty = savedSnapshot !== null && text !== savedSnapshot;

  useEffect(() => {
    onDirtyChange?.(dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  useImperativeHandle(ref, () => ({
    async flushPendingChanges(resolvedSectionId: string) {
      if (!dirty) return;

      try {
        setError("");
        const res = await fetch(`/api/archive/content-sections/${resolvedSectionId}/title`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) {
          setError(body?.reason || "Failed to save title");
          return;
        }
        setSavedSnapshot(text);
      } catch {
        setError("Failed to save title");
      }
    },
  }));

  if (loading) {
    return <p className="text-sm text-textColorThird">{locale === "nb" ? "Laster..." : "Loading..."}</p>;
  }

  return (
    <div>
      <RichTextEditorField value={text} onChange={setText} locale={locale} showItalic size="lg" livePreview />
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
});
