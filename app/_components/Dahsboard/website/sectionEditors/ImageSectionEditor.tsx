// app/_components/Dahsboard/website/sectionEditors/ImageSectionEditor.tsx
"use client";

import BlogImagePicker from "@/app/_components/Dahsboard/website/BlogImagePicker";
import LocalizedTextFieldGroup from "@/app/_components/Dahsboard/website/LocalizedTextFieldGroup";
import type { ImageSectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  blogPostId: string;
  data: ImageSectionData;
  onChange: (data: ImageSectionData) => void;
};

export default function ImageSectionEditor({ blogPostId, data, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <BlogImagePicker
        label="Image"
        blogPostId={blogPostId}
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
      <LocalizedTextFieldGroup
        label="Caption"
        maxLength={500}
        value={data.caption ?? { en: "", no: "" }}
        onChange={(caption) => onChange({ ...data, caption })}
      />
      <div className="flex gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Alignment
          <select
            className="customInput font-normal"
            value={data.alignment ?? "center"}
            onChange={(e) => onChange({ ...data, alignment: e.target.value as ImageSectionData["alignment"] })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Width
          <select
            className="customInput font-normal"
            value={data.width ?? "full"}
            onChange={(e) => onChange({ ...data, width: e.target.value as ImageSectionData["width"] })}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="full">Full</option>
          </select>
        </label>
      </div>
    </div>
  );
}
