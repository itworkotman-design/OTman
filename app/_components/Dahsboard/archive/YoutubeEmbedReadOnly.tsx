"use client";

import { useEffect, useState } from "react";
import { extractYoutubeVideoId, buildYoutubeEmbedUrl } from "@/lib/docArchive/youtubeUtil";

type Props = {
  sectionId: string;
  locale: string;
};

// Read-only counterpart to YoutubeEmbedPanel — the item view page (ItemView)
// only ever browses, never edits (all mutation lives on the settings page),
// so this just renders the saved url as an embedded player, no input. Renders
// nothing at all if no url has ever been saved, same as TitleReadOnly
// hiding an empty title rather than showing an empty section.
export function YoutubeEmbedReadOnly({ sectionId, locale }: Props) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch(`/api/archive/content-sections/${sectionId}/youtube`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (!cancelled && res.ok && body?.ok) {
        setUrl(body.url);
        setTitle(body.title ?? null);
      }
      if (!cancelled) setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  if (loading) {
    return (
      <div className="flex aspect-video w-full max-w-2xl animate-pulse items-center justify-center rounded-xl bg-gray-300">
        <span className="text-sm font-medium text-white">
          {locale === "nb" ? "Laster..." : "Loading..."}
        </span>
      </div>
    );
  }

  const videoId = extractYoutubeVideoId(url);
  if (!videoId) return null;

  return (
    <div className="w-full max-w-2xl">
      {title?.trim() && <p className="mb-2 font-semibold text-textcolor">{title.trim()}</p>}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl">
        <iframe
          src={buildYoutubeEmbedUrl(videoId)}
          title={title?.trim() || "YouTube video"}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
