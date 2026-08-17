// app/_components/Dahsboard/website/sectionEditors/RichTextSectionEditor.tsx
"use client";

import RichTextLocalizedEditor from "@/app/_components/Dahsboard/website/RichTextLocalizedEditor";
import type { RichTextSectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  data: RichTextSectionData;
  onChange: (data: RichTextSectionData) => void;
};

const FONT_SIZE_OPTIONS = [
  { value: "", label: "Default" },
  { value: "14px", label: "Small" },
  { value: "16px", label: "Normal" },
  { value: "20px", label: "Large" },
  { value: "28px", label: "Extra large" },
];

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
      <div className="flex gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Alignment
          <select
            className="customInput font-normal"
            value={data.textAlign ?? "left"}
            onChange={(e) => onChange({ ...data, textAlign: e.target.value as "left" | "center" | "right" })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Text size
          <select
            className="customInput font-normal"
            value={data.fontSize ?? ""}
            onChange={(e) => onChange({ ...data, fontSize: e.target.value || undefined })}
          >
            {FONT_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
