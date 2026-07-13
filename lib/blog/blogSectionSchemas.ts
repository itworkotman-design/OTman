import { z } from "zod";
import { boundedLocalizedText } from "@/lib/blog/localizedText";

// No .min(1): a freshly-added IMAGE/IMAGE_TEXT/GALLERY section starts with
// no file uploaded yet, filled in afterward via the section edit form.
// "Has content" is judged by isSectionNonEmpty, not by Zod at creation time —
// only publishing a post requires at least one non-empty section overall.
const storagePathSchema = z.string();
const urlOrPathSchema = z
  .string()
  .min(1)
  .refine(
    (value) => /^\//.test(value) || /^https?:\/\//i.test(value),
    "Must be a root-relative path or an absolute URL",
  );

export const richTextSectionDataSchema = z.object({
  type: z.literal("RICH_TEXT"),
  html: boundedLocalizedText(20000),
});

export const imageSectionDataSchema = z.object({
  type: z.literal("IMAGE"),
  storagePath: storagePathSchema,
  alt: boundedLocalizedText(300),
  caption: boundedLocalizedText(500).optional(),
  alignment: z.enum(["left", "center", "right"]).optional(),
  width: z.enum(["small", "medium", "full"]).optional(),
});

export const imageTextSectionDataSchema = z.object({
  type: z.literal("IMAGE_TEXT"),
  storagePath: storagePathSchema,
  alt: boundedLocalizedText(300),
  heading: boundedLocalizedText(200).optional(),
  html: boundedLocalizedText(20000),
  imagePosition: z.enum(["left", "right"]),
});

export const gallerySectionDataSchema = z.object({
  type: z.literal("GALLERY"),
  columns: z.union([z.literal(2), z.literal(3)]),
  images: z
    .array(
      z.object({
        storagePath: storagePathSchema,
        alt: boundedLocalizedText(300),
        caption: boundedLocalizedText(500).optional(),
      }),
    )
    .max(12, "A gallery can contain at most 12 images"),
});

export const carouselSectionDataSchema = z.object({
  type: z.literal("CAROUSEL"),
  images: z
    .array(
      z.object({
        storagePath: storagePathSchema,
        alt: boundedLocalizedText(300),
        caption: boundedLocalizedText(500).optional(),
      }),
    )
    .max(12, "A carousel can contain at most 12 images"),
  autoplay: z.boolean().optional(),
  intervalSeconds: z.number().int().min(2).max(30).optional(),
});

export const quoteSectionDataSchema = z.object({
  type: z.literal("QUOTE"),
  quote: boundedLocalizedText(500),
  attribution: boundedLocalizedText(200).optional(),
});

export const ctaSectionDataSchema = z.object({
  type: z.literal("CTA"),
  heading: boundedLocalizedText(200).optional(),
  text: boundedLocalizedText(500).optional(),
  buttonLabel: boundedLocalizedText(100),
  buttonUrl: urlOrPathSchema,
  openInNewTab: z.boolean().optional(),
});

export const dividerSectionDataSchema = z.object({
  type: z.literal("DIVIDER"),
  style: z.enum(["solid", "dashed"]),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color")
    .optional(),
  thickness: z.enum(["thin", "medium", "thick"]).optional(),
});

export const spacerSectionDataSchema = z.object({
  type: z.literal("SPACER"),
  size: z.enum(["small", "medium", "large"]),
});

export const blogSectionDataSchema = z.discriminatedUnion("type", [
  richTextSectionDataSchema,
  imageSectionDataSchema,
  imageTextSectionDataSchema,
  gallerySectionDataSchema,
  carouselSectionDataSchema,
  quoteSectionDataSchema,
  ctaSectionDataSchema,
  dividerSectionDataSchema,
  spacerSectionDataSchema,
]);

export type BlogSectionData = z.infer<typeof blogSectionDataSchema>;
export type RichTextSectionData = z.infer<typeof richTextSectionDataSchema>;
export type ImageSectionData = z.infer<typeof imageSectionDataSchema>;
export type ImageTextSectionData = z.infer<typeof imageTextSectionDataSchema>;
export type GallerySectionData = z.infer<typeof gallerySectionDataSchema>;
export type CarouselSectionData = z.infer<typeof carouselSectionDataSchema>;
export type QuoteSectionData = z.infer<typeof quoteSectionDataSchema>;
export type CtaSectionData = z.infer<typeof ctaSectionDataSchema>;
export type DividerSectionData = z.infer<typeof dividerSectionDataSchema>;
export type SpacerSectionData = z.infer<typeof spacerSectionDataSchema>;

export const BLOG_SECTION_TYPES = [
  "RICH_TEXT",
  "IMAGE",
  "IMAGE_TEXT",
  "GALLERY",
  "CAROUSEL",
  "QUOTE",
  "CTA",
  "DIVIDER",
  "SPACER",
] as const;

export type BlogSectionTypeValue = (typeof BLOG_SECTION_TYPES)[number];

export function isSectionNonEmpty(section: BlogSectionData): boolean {
  switch (section.type) {
    case "RICH_TEXT":
      return Boolean(section.html.en.trim() || section.html.no.trim());
    case "IMAGE_TEXT":
      return Boolean(section.storagePath && (section.html.en.trim() || section.html.no.trim()));
    case "IMAGE":
      return Boolean(section.storagePath);
    case "GALLERY":
    case "CAROUSEL":
      return section.images.length > 0;
    case "QUOTE":
      return Boolean(section.quote.en.trim() || section.quote.no.trim());
    case "CTA":
      return Boolean(section.buttonLabel.en.trim() || section.buttonLabel.no.trim());
    case "DIVIDER":
    case "SPACER":
      return true;
    default:
      return false;
  }
}
