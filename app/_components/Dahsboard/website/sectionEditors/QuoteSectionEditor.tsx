// app/_components/Dahsboard/website/sectionEditors/QuoteSectionEditor.tsx
"use client";

import LocalizedTextFieldGroup from "@/app/_components/Dahsboard/website/LocalizedTextFieldGroup";
import type { QuoteSectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  data: QuoteSectionData;
  onChange: (data: QuoteSectionData) => void;
};

export default function QuoteSectionEditor({ data, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <LocalizedTextFieldGroup
        label="Quote"
        required
        multiline
        maxLength={500}
        value={data.quote}
        onChange={(quote) => onChange({ ...data, quote })}
      />
      <LocalizedTextFieldGroup
        label="Attribution"
        maxLength={200}
        value={data.attribution ?? { en: "", no: "" }}
        onChange={(attribution) => onChange({ ...data, attribution })}
      />
    </div>
  );
}
