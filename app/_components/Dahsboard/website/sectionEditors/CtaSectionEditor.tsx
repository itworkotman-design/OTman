// app/_components/Dahsboard/website/sectionEditors/CtaSectionEditor.tsx
"use client";

import LocalizedTextFieldGroup from "@/app/_components/Dahsboard/website/LocalizedTextFieldGroup";
import type { CtaSectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  data: CtaSectionData;
  onChange: (data: CtaSectionData) => void;
};

export default function CtaSectionEditor({ data, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <LocalizedTextFieldGroup
        label="Heading"
        maxLength={200}
        value={data.heading ?? { en: "", no: "" }}
        onChange={(heading) => onChange({ ...data, heading })}
      />
      <LocalizedTextFieldGroup
        label="Text"
        multiline
        maxLength={500}
        value={data.text ?? { en: "", no: "" }}
        onChange={(text) => onChange({ ...data, text })}
      />
      <LocalizedTextFieldGroup
        label="Button label"
        required
        maxLength={100}
        value={data.buttonLabel}
        onChange={(buttonLabel) => onChange({ ...data, buttonLabel })}
      />
      <label className="flex flex-col gap-1 text-sm">
        Button URL
        <input
          className="customInput font-normal"
          value={data.buttonUrl}
          onChange={(e) => onChange({ ...data, buttonUrl: e.target.value })}
          placeholder="/blogg or https://..."
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={data.openInNewTab ?? false}
          onChange={(e) => onChange({ ...data, openInNewTab: e.target.checked })}
        />
        Open in new tab
      </label>
    </div>
  );
}
