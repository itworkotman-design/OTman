// app/_components/Dahsboard/website/sectionEditors/CarouselSectionEditor.tsx
"use client";

import BlogImagePicker from "@/app/_components/Dahsboard/website/BlogImagePicker";
import LocalizedTextFieldGroup from "@/app/_components/Dahsboard/website/LocalizedTextFieldGroup";
import type { CarouselSectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  blogPostId: string;
  data: CarouselSectionData;
  onChange: (data: CarouselSectionData) => void;
};

const MAX_IMAGES = 12;

export default function CarouselSectionEditor({ blogPostId, data, onChange }: Props) {
  function updateImage(index: number, patch: Partial<CarouselSectionData["images"][number]>) {
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={data.autoplay ?? false}
          onChange={(e) => onChange({ ...data, autoplay: e.target.checked })}
        />
        Autoplay
      </label>

      {data.autoplay ? (
        <label className="flex flex-col gap-1 text-sm">
          Seconds between slides
          <input
            type="number"
            min={2}
            max={30}
            className="customInput w-24 font-normal"
            value={data.intervalSeconds ?? 5}
            onChange={(e) => onChange({ ...data, intervalSeconds: Number(e.target.value) })}
          />
        </label>
      ) : null}

      <div className="flex flex-col gap-4">
        {data.images.map((image, index) => (
          <div key={index} className="rounded-md border border-linePrimary p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-textcolor">Slide {index + 1}</span>
              <button type="button" className="customButtonDefault !px-2 !py-1 text-xs" onClick={() => removeImage(index)}>
                Remove
              </button>
            </div>
            <BlogImagePicker
              blogPostId={blogPostId}
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
          Add slide
        </button>
      ) : null}
    </div>
  );
}
