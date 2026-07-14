// app/_components/Dahsboard/website/LocalizedTextFieldGroup.tsx
"use client";

import type { LocalizedTextValue } from "@/lib/blog/localizedText";

type Props = {
  label: string;
  value: LocalizedTextValue;
  onChange: (value: LocalizedTextValue) => void;
  multiline?: boolean;
  maxLength?: number;
  required?: boolean;
};

export default function LocalizedTextFieldGroup({
  label,
  value,
  onChange,
  multiline,
  maxLength,
  required,
}: Props) {
  const Field = multiline ? "textarea" : "input";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-textcolor">
        {label}
        {required ? " *" : ""}
      </span>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["en", "no"] as const).map((locale) => (
          <label key={locale} className="flex flex-col gap-1 text-xs text-textColorSecond">
            <span className="uppercase">{locale}</span>
            <Field
              className="customInput font-normal"
              maxLength={maxLength}
              rows={multiline ? 4 : undefined}
              value={value[locale]}
              onChange={(e) => onChange({ ...value, [locale]: e.target.value })}
            />
            {maxLength ? (
              <span className="self-end text-[11px] text-textColorSecond">
                {value[locale].length}/{maxLength}
              </span>
            ) : null}
          </label>
        ))}
      </div>
    </div>
  );
}
