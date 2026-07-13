// app/_components/Dahsboard/website/sectionEditors/DividerSectionEditor.tsx
"use client";

import type { DividerSectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  data: DividerSectionData;
  onChange: (data: DividerSectionData) => void;
};

const DEFAULT_DIVIDER_COLOR = "#d1d5db";

export default function DividerSectionEditor({ data, onChange }: Props) {
  const color = /^#[0-9a-fA-F]{6}$/.test(data.color ?? "") ? (data.color as string) : DEFAULT_DIVIDER_COLOR;

  return (
    <div className="flex flex-wrap items-end gap-4">
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

      <label className="flex flex-col gap-1 text-sm">
        Thickness
        <select
          className="customInput font-normal"
          value={data.thickness ?? "medium"}
          onChange={(e) => onChange({ ...data, thickness: e.target.value as DividerSectionData["thickness"] })}
        >
          <option value="thin">Thin</option>
          <option value="medium">Medium</option>
          <option value="thick">Thick</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        Color
        <input
          type="color"
          className="h-9 w-12 cursor-pointer rounded border border-linePrimary"
          value={color}
          onChange={(e) => onChange({ ...data, color: e.target.value })}
        />
      </label>
    </div>
  );
}
