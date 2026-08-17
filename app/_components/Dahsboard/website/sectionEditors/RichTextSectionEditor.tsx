// app/_components/Dahsboard/website/sectionEditors/RichTextSectionEditor.tsx
"use client";

import RichTextLocalizedEditor from "@/app/_components/Dahsboard/website/RichTextLocalizedEditor";
import SectionTextStyleFields from "@/app/_components/Dahsboard/website/SectionTextStyleFields";
import type { RichTextSectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  data: RichTextSectionData;
  onChange: (data: RichTextSectionData) => void;
};

export default function RichTextSectionEditor({ data, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <RichTextLocalizedEditor
        label="Text"
        value={data.html}
        onChange={(html) => onChange({ ...data, html })}
      />
      {/* Alignment and font size apply to the whole section, not per
          language — RichTextLocalizedEditor's own toolbar has no align
          control and no font-size control for that reason. */}
      <SectionTextStyleFields
        textAlign={data.textAlign}
        onTextAlignChange={(textAlign) => onChange({ ...data, textAlign })}
        fontSize={data.fontSize}
        onFontSizeChange={(fontSize) => onChange({ ...data, fontSize })}
      />
    </div>
  );
}
