// app/_components/Dahsboard/website/RichTextLocalizedEditor.tsx
"use client";

import { RichTextEditorField } from "@/app/_components/Dahsboard/RichTextEditorField";
import type { LocalizedTextValue } from "@/lib/blog/localizedText";

type Props = {
  label: string;
  value: LocalizedTextValue;
  onChange: (value: LocalizedTextValue) => void;
};

const LOCALES = [
  { key: "en", heading: "English" },
  { key: "no", heading: "Norsk" },
] as const;

// Both languages are edited side by side, at all times — previously this
// showed one language at a time behind an EN/NO toggle button, with
// whole-text bold/italic/underline/color changes mirrored into the hidden
// language's document via a separate headless editor instance. That mirror
// re-parsed the other language's stored HTML from scratch on every toggle,
// so its "is this already formatted" read could disagree with the visible
// editor's own (e.g. toggling underline on with nothing selected select-all
// applied it, but the mirrored copy's differently-shaped HTML sometimes read
// the whole doc as already underlined and unset it instead — the fix is
// removing the indirection, not repairing it). With both languages visible
// at once there's no need for one language's edit to silently reach into the
// other's document — each editor only ever touches its own text.
export default function RichTextLocalizedEditor({ label, value, onChange }: Props) {
  function handleChange(locale: "en" | "no", html: string) {
    onChange({ ...value, [locale]: html });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-textcolor">{label}</span>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {LOCALES.map(({ key, heading }) => (
          <div key={key} className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase text-textColorSecond">{heading}</span>
            <RichTextEditorField
              value={value[key]}
              onChange={(html) => handleChange(key, html)}
              showItalic
              showUnderline
              showLink
              linkAdvanced
              showAlign={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
