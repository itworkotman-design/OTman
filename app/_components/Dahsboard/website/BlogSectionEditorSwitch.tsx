// app/_components/Dahsboard/website/BlogSectionEditorSwitch.tsx
"use client";

import RichTextSectionEditor from "@/app/_components/Dahsboard/website/sectionEditors/RichTextSectionEditor";
import ImageSectionEditor from "@/app/_components/Dahsboard/website/sectionEditors/ImageSectionEditor";
import ImageTextSectionEditor from "@/app/_components/Dahsboard/website/sectionEditors/ImageTextSectionEditor";
import GallerySectionEditor from "@/app/_components/Dahsboard/website/sectionEditors/GallerySectionEditor";
import CarouselSectionEditor from "@/app/_components/Dahsboard/website/sectionEditors/CarouselSectionEditor";
import QuoteSectionEditor from "@/app/_components/Dahsboard/website/sectionEditors/QuoteSectionEditor";
import CtaSectionEditor from "@/app/_components/Dahsboard/website/sectionEditors/CtaSectionEditor";
import DividerSectionEditor from "@/app/_components/Dahsboard/website/sectionEditors/DividerSectionEditor";
import SpacerSectionEditor from "@/app/_components/Dahsboard/website/sectionEditors/SpacerSectionEditor";
import type { BlogSectionData } from "@/lib/blog/blogSectionSchemas";

type Props = {
  blogPostId: string;
  data: BlogSectionData;
  onChange: (data: BlogSectionData) => void;
};

const DEFAULT_BACKGROUND_COLOR = "#ffffff";

export default function BlogSectionEditorSwitch({ blogPostId, data, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {renderSectionEditor(blogPostId, data, onChange)}

      <div className="flex items-center gap-2 border-t border-linePrimary pt-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Background color
          <div className="flex items-center gap-2">
            <input
              aria-label="Background color"
              type="color"
              className="h-8 w-12 cursor-pointer rounded border border-linePrimary"
              value={data.backgroundColor ?? DEFAULT_BACKGROUND_COLOR}
              onChange={(e) => onChange({ ...data, backgroundColor: e.target.value })}
            />
            <button
              type="button"
              className="customButtonDefault !px-2 !py-1 text-xs"
              disabled={!data.backgroundColor}
              onClick={() => onChange({ ...data, backgroundColor: undefined })}
            >
              Reset
            </button>
          </div>
        </label>
      </div>
    </div>
  );
}

function renderSectionEditor(blogPostId: string, data: BlogSectionData, onChange: (data: BlogSectionData) => void) {
  switch (data.type) {
    case "RICH_TEXT":
      return <RichTextSectionEditor data={data} onChange={onChange} />;
    case "IMAGE":
      return <ImageSectionEditor blogPostId={blogPostId} data={data} onChange={onChange} />;
    case "IMAGE_TEXT":
      return <ImageTextSectionEditor blogPostId={blogPostId} data={data} onChange={onChange} />;
    case "GALLERY":
      return <GallerySectionEditor blogPostId={blogPostId} data={data} onChange={onChange} />;
    case "CAROUSEL":
      return <CarouselSectionEditor blogPostId={blogPostId} data={data} onChange={onChange} />;
    case "QUOTE":
      return <QuoteSectionEditor data={data} onChange={onChange} />;
    case "CTA":
      return <CtaSectionEditor data={data} onChange={onChange} />;
    case "DIVIDER":
      return <DividerSectionEditor data={data} onChange={onChange} />;
    case "SPACER":
      return <SpacerSectionEditor data={data} onChange={onChange} />;
    default:
      return null;
  }
}
