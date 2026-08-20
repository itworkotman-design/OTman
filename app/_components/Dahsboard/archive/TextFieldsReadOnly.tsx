"use client";

import { useEffect, useState } from "react";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";
import type { ArchiveTextFieldRow } from "@/app/_components/Dahsboard/archive/TextFieldsPanel";

function isEmptyHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

type Props = {
  sectionId: string;
  locale: string;
};

// Read-only counterpart to TextFieldsPanel — the item view page (ItemView)
// only ever browses, never edits (all mutation lives on the settings page),
// so this skips every add/edit/delete affordance and just renders each
// field's label + sanitized HTML value.
export function TextFieldsReadOnly({ sectionId, locale }: Props) {
  const [fields, setFields] = useState<ArchiveTextFieldRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch(`/api/archive/content-sections/${sectionId}/text-fields`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!cancelled && res.ok && data?.ok) setFields(data.fields ?? []);
      if (!cancelled) setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  if (loading) {
    return (
      <div className="flex h-32 w-full animate-pulse items-center justify-center rounded-[20px] bg-gray-300">
        <span className="text-sm font-medium text-white">
          {locale === "nb" ? "Laster..." : "Loading..."}
        </span>
      </div>
    );
  }

  if (fields.length === 0) {
    return <p className="text-sm text-textColorThird">{locale === "nb" ? "Ingen tekstfelt" : "No text fields"}</p>;
  }

  return (
    <div className="rounded-[20px] py-5 pr-5 divide-y divide-lineSecondary">
      {fields.map((field) => (
        <div key={field.id} className="py-3 first:pt-0 last:pb-0">
          {isEmptyHtml(field.label) ? null : (
            <div
              className="rich-text-content prose max-w-none font-semibold text-logoblue [&_p]:m-0"
              dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(field.label) }}
            />
          )}
          {isEmptyHtml(field.value) ? null : (
            <div
              className="rich-text-content prose mt-1 max-w-none text-sm text-textColorSecond [&_p]:m-0"
              dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(field.value) }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
