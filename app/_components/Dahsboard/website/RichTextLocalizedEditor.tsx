// app/_components/Dahsboard/website/RichTextLocalizedEditor.tsx
"use client";

import { useState } from "react";
import RichTextEditorField from "@/app/_components/Dahsboard/website/RichTextEditorField";
import type { LocalizedTextValue } from "@/lib/blog/localizedText";

type Props = {
  label: string;
  value: LocalizedTextValue;
  onChange: (value: LocalizedTextValue) => void;
};

export default function RichTextLocalizedEditor({ label, value, onChange }: Props) {
  const [activeLocale, setActiveLocale] = useState<"en" | "no">("en");

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
        onChange={(html) => onChange({ ...value, [activeLocale]: html })}
      />
    </div>
  );
}
