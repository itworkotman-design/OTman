// app/_components/Dahsboard/website/sectionEditors/DividerSectionEditor.tsx
"use client";

import type { DividerSectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  data: DividerSectionData;
  onChange: (data: DividerSectionData) => void;
};

export default function DividerSectionEditor({ data, onChange }: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      Style
      <select
        className="customInput font-normal"
        value={data.style}
        onChange={(e) => onChange({ ...data, style: e.target.value as DividerSectionData["style"] })}
      >
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
      </select>
    </label>
  );
}
