// app/_components/Dahsboard/website/BlogSectionPicker.tsx
"use client";

import { BLOG_SECTION_TYPES, type BlogSectionTypeValue } from "@/lib/blog/blogSectionSchemas";
import { SECTION_TYPE_LABELS } from "@/lib/blog/defaultSectionData";

type Props = {
  onPick: (type: BlogSectionTypeValue) => void;
  onClose: () => void;
};

export default function BlogSectionPicker({ onPick, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-textcolor">Add section</h2>
          <button type="button" className="customButtonDefault" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {BLOG_SECTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className="flex flex-col items-start rounded-md border border-linePrimary p-4 text-left hover:bg-linePrimary/40"
              onClick={() => {
                onPick(type);
                onClose();
              }}
            >
              <span className="font-semibold text-textcolor">{SECTION_TYPE_LABELS[type].name}</span>
              <span className="mt-1 text-sm text-textColorSecond">{SECTION_TYPE_LABELS[type].description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
