// app/_components/Dahsboard/website/SectionTextStyleFields.tsx
"use client";

import { RICH_TEXT_FONT_SIZE_OPTIONS } from "@/lib/blog/richTextFontSizes";

type TextAlign = "left" | "center" | "right";

type Props = {
  textAlign: TextAlign | undefined;
  onTextAlignChange: (value: TextAlign) => void;
  fontSize: string | undefined;
  onFontSizeChange: (value: string | undefined) => void;
};

// Alignment and font size that apply to a whole section regardless of which
// language is being edited — a section-level counterpart to the per-language
// marks RichTextEditorField's own toolbar offers. Only rendered by section
// editors that actually want this (currently just RichTextSectionEditor);
// a section that doesn't need it, like ImageTextSectionEditor's Heading,
// simply doesn't render this component rather than needing its own copy.
export default function SectionTextStyleFields({ textAlign, onTextAlignChange, fontSize, onFontSizeChange }: Props) {
  return (
    <div className="flex gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Alignment
        <select
          className="customInput font-normal"
          value={textAlign ?? "left"}
          onChange={(e) => onTextAlignChange(e.target.value as TextAlign)}
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
          value={fontSize ?? ""}
          onChange={(e) => onFontSizeChange(e.target.value || undefined)}
        >
          {RICH_TEXT_FONT_SIZE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.labelEn}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
