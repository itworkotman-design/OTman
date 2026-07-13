// app/_components/Dahsboard/website/sectionEditors/GallerySectionEditor.tsx
"use client";

import BlogImagePicker from "@/app/_components/Dahsboard/website/BlogImagePicker";
import LocalizedTextFieldGroup from "@/app/_components/Dahsboard/website/LocalizedTextFieldGroup";
import type { GallerySectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  data: GallerySectionData;
  onChange: (data: GallerySectionData) => void;
};

const MAX_IMAGES = 12;

export default function GallerySectionEditor({ data, onChange }: Props) {
  function updateImage(index: number, patch: Partial<GallerySectionData["images"][number]>) {
    const images = data.images.map((image, i) => (i === index ? { ...image, ...patch } : image));
    onChange({ ...data, images });
  }

  function addImage() {
    if (data.images.length >= MAX_IMAGES) return;
    onChange({
      ...data,
      images: [...data.images, { storagePath: "", alt: { en: "", no: "" }, caption: { en: "", no: "" } }],
    });
  }

  function removeImage(index: number) {
    onChange({ ...data, images: data.images.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Columns
        <select
          className="customInput font-normal"
          value={data.columns}
          onChange={(e) => onChange({ ...data, columns: Number(e.target.value) as 2 | 3 })}
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </label>

      <div className="flex flex-col gap-4">
        {data.images.map((image, index) => (
          <div key={index} className="rounded-md border border-linePrimary p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-textcolor">Image {index + 1}</span>
              <button type="button" className="customButtonDefault !px-2 !py-1 text-xs" onClick={() => removeImage(index)}>
                Remove
              </button>
            </div>
            <BlogImagePicker
              storagePath={image.storagePath || null}
              onChange={(storagePath) => updateImage(index, { storagePath: storagePath ?? "" })}
            />
            <div className="mt-2">
              <LocalizedTextFieldGroup
                label="Alt text"
                required
                maxLength={300}
                value={image.alt}
                onChange={(alt) => updateImage(index, { alt })}
              />
            </div>
            <div className="mt-2">
              <LocalizedTextFieldGroup
                label="Caption"
                maxLength={500}
                value={image.caption ?? { en: "", no: "" }}
                onChange={(caption) => updateImage(index, { caption })}
              />
            </div>
          </div>
        ))}
      </div>

      {data.images.length < MAX_IMAGES ? (
        <button type="button" className="customButtonDefault self-start" onClick={addImage}>
          Add image
        </button>
      ) : null}
    </div>
  );
}
