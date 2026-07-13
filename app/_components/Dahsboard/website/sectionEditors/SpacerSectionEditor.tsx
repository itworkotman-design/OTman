// app/_components/Dahsboard/website/sectionEditors/SpacerSectionEditor.tsx
"use client";

import type { SpacerSectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  data: SpacerSectionData;
  onChange: (data: SpacerSectionData) => void;
};

export default function SpacerSectionEditor({ data, onChange }: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      Size
      <select
        className="customInput font-normal"
        value={data.size}
        onChange={(e) => onChange({ ...data, size: e.target.value as SpacerSectionData["size"] })}
      >
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>
    </label>
  );
}
