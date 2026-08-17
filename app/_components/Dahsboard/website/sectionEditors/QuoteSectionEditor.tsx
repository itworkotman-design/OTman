// app/_components/Dahsboard/website/sectionEditors/QuoteSectionEditor.tsx
"use client";

import RichTextLocalizedEditor from "@/app/_components/Dahsboard/website/RichTextLocalizedEditor";
import type { QuoteSectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  data: QuoteSectionData;
  onChange: (data: QuoteSectionData) => void;
};

export default function QuoteSectionEditor({ data, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <RichTextLocalizedEditor
        label="Quote"
        value={data.quote}
        onChange={(quote) => onChange({ ...data, quote })}
      />
      <RichTextLocalizedEditor
        label="Attribution"
        value={data.attribution ?? { en: "", no: "" }}
        onChange={(attribution) => onChange({ ...data, attribution })}
      />
    </div>
  );
}
