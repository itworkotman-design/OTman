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
    return <p className="text-sm text-textColorThird">{locale === "nb" ? "Laster..." : "Loading..."}</p>;
  }

  if (fields.length === 0) {
    return <p className="text-sm text-textColorThird">{locale === "nb" ? "Ingen tekstfelt" : "No text fields"}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {fields.map((field) => (
        <div key={field.id} className="rounded-xl border border-lineSecondary px-4 py-3">
          <span className="font-semibold text-logoblue">{field.label}</span>
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
