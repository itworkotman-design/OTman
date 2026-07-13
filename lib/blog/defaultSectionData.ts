import type { BlogSectionData, BlogSectionTypeValue } from "@/lib/blog/blogSectionSchemas";

const EMPTY_TEXT = { en: "", no: "" };

export function getDefaultSectionData(type: BlogSectionTypeValue): BlogSectionData {
  switch (type) {
    case "RICH_TEXT":
      return { type, html: EMPTY_TEXT };
    case "IMAGE":
      return { type, storagePath: "", alt: EMPTY_TEXT };
    case "IMAGE_TEXT":
      return { type, storagePath: "", alt: EMPTY_TEXT, html: EMPTY_TEXT, imagePosition: "left" };
    case "GALLERY":
      return { type, columns: 2, images: [] };
    case "QUOTE":
      return { type, quote: EMPTY_TEXT };
    case "CTA":
      return { type, buttonLabel: EMPTY_TEXT, buttonUrl: "/" };
    case "DIVIDER":
      return { type, style: "solid" };
    case "SPACER":
      return { type, size: "medium" };
    default:
      throw new Error(`Unknown section type: ${type}`);
  }
}

export const SECTION_TYPE_LABELS: Record<BlogSectionTypeValue, { name: string; description: string }> = {
  RICH_TEXT: { name: "Rich text", description: "A paragraph of formatted text." },
  IMAGE: { name: "Image", description: "A single image with optional caption." },
  IMAGE_TEXT: { name: "Image with text", description: "An image next to a block of text." },
  GALLERY: { name: "Image gallery", description: "A grid of multiple images." },
  QUOTE: { name: "Quote", description: "A pull quote with optional attribution." },
  CTA: { name: "Call to action", description: "A heading, text, and button." },
  DIVIDER: { name: "Divider", description: "A horizontal rule between sections." },
  SPACER: { name: "Spacer", description: "Vertical empty space." },
};
