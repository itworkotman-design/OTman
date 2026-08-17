// app/_components/Dahsboard/website/RichTextLocalizedEditor.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { RichTextEditorField } from "@/app/_components/Dahsboard/RichTextEditorField";
import { applyWholeDocMarkToHtml, type WholeDocMarkChange } from "@/lib/blog/tiptapHeadlessMirror";
import type { LocalizedTextValue } from "@/lib/blog/localizedText";

type Props = {
  label: string;
  value: LocalizedTextValue;
  onChange: (value: LocalizedTextValue) => void;
  // Body paragraphs mirror a whole-text bold/italic/underline/color change
  // into the other language (see handleWholeDocMark below) — short one-line
  // fields like a section's "Heading" don't get the same treatment, since
  // there's little reason a title's formatting in one language should force
  // the other language's title to match.
  mirrorWholeDoc?: boolean;
};

export default function RichTextLocalizedEditor({ label, value, onChange, mirrorWholeDoc = true }: Props) {
  const [activeLocale, setActiveLocale] = useState<"en" | "no">("en");
  // Both the field's own onChange and onWholeDocMark below can fire within
  // the same click (bold's onUpdate, then the mirror into the other
  // language) — `value` as a prop only reflects the first of those until
  // the next render, so a second `{ ...value, ... }` spread would silently
  // drop the first update. This ref is updated synchronously by both
  // handlers instead, so each always builds on the other's latest write.
  const latestValue = useRef(value);
  useEffect(() => {
    latestValue.current = value;
  }, [value]);

  function handleFieldChange(html: string) {
    latestValue.current = { ...latestValue.current, [activeLocale]: html };
    onChange(latestValue.current);
  }

  function handleWholeDocMark(mark: WholeDocMarkChange) {
    const otherLocale = activeLocale === "en" ? "no" : "en";
    const mirroredHtml = applyWholeDocMarkToHtml(latestValue.current[otherLocale], mark);
    latestValue.current = { ...latestValue.current, [otherLocale]: mirroredHtml };
    onChange(latestValue.current);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-textcolor">{label}</span>
        <div className="flex gap-1">
          {(["en", "no"] as const).map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => setActiveLocale(locale)}
              className={`customButtonDefault !px-3 !py-1 text-xs uppercase ${
                activeLocale === locale ? "bg-linePrimary" : ""
              }`}
            >
              {locale}
            </button>
          ))}
        </div>
      </div>
      <RichTextEditorField
        value={value[activeLocale]}
        onChange={handleFieldChange}
        onWholeDocMark={mirrorWholeDoc ? handleWholeDocMark : undefined}
        showItalic
        showUnderline
        showLink
        linkAdvanced
        showAlign={false}
      />
    </div>
  );
}
