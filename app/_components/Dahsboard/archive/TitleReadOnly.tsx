"use client";

import { useEffect, useState } from "react";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";

function isEmptyHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

type Props = {
  sectionId: string;
  locale: string;
};

// Read-only counterpart to TitlePanel — the item view page (ItemView) only
// ever browses, never edits (all mutation lives on the settings page), so
// this just renders the saved, sanitized HTML (bold/italic/color/alignment
// from RichTextEditorField) as a large heading, no input.
export function TitleReadOnly({ sectionId, locale }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch(`/api/archive/content-sections/${sectionId}/title`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (!cancelled && res.ok && body?.ok) setText(body.text);
      if (!cancelled) setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  if (loading) {
    return <p className="text-sm text-textColorThird">{locale === "nb" ? "Laster..." : "Loading..."}</p>;
  }

  if (isEmptyHtml(text)) {
    return null;
  }

  return (
    <div
      className="rich-text-content prose max-w-none text-xl font-semibold text-textcolor [&_p]:m-0"
      dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(text) }}
    />
  );
}
