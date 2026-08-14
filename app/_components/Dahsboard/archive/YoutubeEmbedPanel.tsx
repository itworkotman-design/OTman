"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { extractYoutubeVideoId, buildYoutubeEmbedUrl } from "@/lib/docArchive/youtubeUtil";

export type YoutubeEmbedPanelHandle = {
  // Takes the section's real id as a call-time argument — same reasoning as
  // TitlePanelHandle.flushPendingChanges (a pending section has no real id
  // until Save's first phase creates it).
  flushPendingChanges: (sectionId: string) => Promise<void>;
};

type YoutubeEmbedPanelProps = {
  // `null` means a not-yet-created (pending) section — nothing to fetch yet,
  // starts from an empty url until a real id exists.
  sectionId: string | null;
  locale: string;
  onDirtyChange?: (dirty: boolean) => void;
};

// A single YouTube embed content section — structurally the same as
// TitlePanel (one value, deferred-save via flushPendingChanges), just a URL
// input instead of a rich-text editor. Validates client-side via the same
// extractYoutubeVideoId the server re-checks on save, and shows a live
// preview iframe the moment the pasted URL parses.
export const YoutubeEmbedPanel = forwardRef<YoutubeEmbedPanelHandle, YoutubeEmbedPanelProps>(
  function YoutubeEmbedPanel({ sectionId, locale, onDirtyChange }, ref) {
    const [url, setUrl] = useState("");
    const [title, setTitle] = useState("");
    const [savedSnapshot, setSavedSnapshot] = useState<{ url: string; title: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function load() {
      if (!sectionId) {
        setUrl("");
        setTitle("");
        setSavedSnapshot({ url: "", title: "" });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/archive/content-sections/${sectionId}/youtube`, {
          credentials: "include",
          cache: "no-store",
        });
        const body = await res.json().catch(() => null);
        if (res.ok && body?.ok) {
          setUrl(body.url);
          setTitle(body.title ?? "");
          setSavedSnapshot({ url: body.url, title: body.title ?? "" });
        } else {
          setError(body?.reason || "Failed to load YouTube embed");
        }
      } catch {
        setError("Failed to load YouTube embed");
      } finally {
        setLoading(false);
      }
    }

    // Same spurious-re-run guard as TitlePanel — see its comment for why a
    // keyed-list reorder can re-run this effect with `sectionId` unchanged,
    // and why the pending -> real-id transition must adopt the new id
    // without a refetch (would otherwise race flushPendingChanges).
    const loadedForRef = useRef<string | null | undefined>(undefined);

    useEffect(() => {
      if (loadedForRef.current === sectionId) return;
      const wasPending = loadedForRef.current === null;
      loadedForRef.current = sectionId;
      if (sectionId && wasPending) return;

      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sectionId]);

    const dirty = savedSnapshot !== null && (url !== savedSnapshot.url || title !== savedSnapshot.title);

    useEffect(() => {
      onDirtyChange?.(dirty);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dirty]);

    useImperativeHandle(ref, () => ({
      async flushPendingChanges(resolvedSectionId: string) {
        if (!dirty) return;

        try {
          setError("");
          const res = await fetch(`/api/archive/content-sections/${resolvedSectionId}/youtube`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, title }),
          });
          const body = await res.json().catch(() => null);
          if (!res.ok || !body?.ok) {
            setError(body?.reason || "Failed to save YouTube embed");
            return;
          }
          setSavedSnapshot({ url, title });
        } catch {
          setError("Failed to save YouTube embed");
        }
      },
    }));

    if (loading) {
      return <p className="text-sm text-textColorThird">{locale === "nb" ? "Laster..." : "Loading..."}</p>;
    }

    const trimmed = url.trim();
    const videoId = trimmed ? extractYoutubeVideoId(trimmed) : null;
    const invalid = trimmed.length > 0 && !videoId;

    return (
      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={locale === "nb" ? "Tittel (valgfritt)..." : "Title (optional)..."}
          maxLength={200}
          className="customInput w-full"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={locale === "nb" ? "Lim inn en YouTube-lenke..." : "Paste a YouTube link..."}
          className="customInput mt-2 w-full"
        />
        {invalid && (
          <p className="mt-2 text-sm text-red-600">
            {locale === "nb" ? "Fant ingen gyldig YouTube-video i denne lenken." : "Couldn't find a valid YouTube video in that link."}
          </p>
        )}
        {videoId && (
          <div className="mt-3 max-w-2xl">
            {title.trim() && <p className="mb-2 font-semibold text-textcolor">{title.trim()}</p>}
            <div className="relative aspect-video w-full overflow-hidden rounded-xl">
              <iframe
                src={buildYoutubeEmbedUrl(videoId)}
                title="YouTube video preview"
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
      </div>
    );
  },
);
