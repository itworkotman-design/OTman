// app/_components/Dahsboard/website/sectionEditors/RichTextSectionEditor.tsx
"use client";

import RichTextLocalizedEditor from "@/app/_components/Dahsboard/website/RichTextLocalizedEditor";
import type { RichTextSectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  data: RichTextSectionData;
  onChange: (data: RichTextSectionData) => void;
};

export default function RichTextSectionEditor({ data, onChange }: Props) {
  return (
    <RichTextLocalizedEditor
      label="Text"
      value={data.html}
      onChange={(html) => onChange({ ...data, html })}
    />
  );
}
