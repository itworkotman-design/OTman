// app/_components/Dahsboard/website/sectionEditors/ImageTextSectionEditor.tsx
"use client";

import BlogImagePicker from "@/app/_components/Dahsboard/website/BlogImagePicker";
import LocalizedTextFieldGroup from "@/app/_components/Dahsboard/website/LocalizedTextFieldGroup";
import RichTextLocalizedEditor from "@/app/_components/Dahsboard/website/RichTextLocalizedEditor";
import type { ImageTextSectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  data: ImageTextSectionData;
  onChange: (data: ImageTextSectionData) => void;
};

export default function ImageTextSectionEditor({ data, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <BlogImagePicker
        label="Image"
        storagePath={data.storagePath || null}
        onChange={(storagePath) => onChange({ ...data, storagePath: storagePath ?? "" })}
      />
      <LocalizedTextFieldGroup
        label="Alt text"
        required
        maxLength={300}
        value={data.alt}
        onChange={(alt) => onChange({ ...data, alt })}
      />
      <label className="flex flex-col gap-1 text-sm">
        Image position
        <select
          className="customInput font-normal"
          value={data.imagePosition}
          onChange={(e) => onChange({ ...data, imagePosition: e.target.value as ImageTextSectionData["imagePosition"] })}
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </label>
      <LocalizedTextFieldGroup
        label="Heading"
        maxLength={200}
        value={data.heading ?? { en: "", no: "" }}
        onChange={(heading) => onChange({ ...data, heading })}
      />
      <RichTextLocalizedEditor
        label="Text"
        value={data.html}
        onChange={(html) => onChange({ ...data, html })}
      />
    </div>
  );
}
