import { z } from "zod";
import { boundedLocalizedText } from "@/lib/blog/localizedText";
import { blogSectionDataSchema, BLOG_SECTION_TYPES } from "@/lib/blog/blogSectionSchemas";

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(200)
  .regex(SLUG_PATTERN, "Slug may only contain lowercase letters, numbers, and hyphens");

export const createBlogPostSchema = z.object({
  title: boundedLocalizedText(200),
  slug: slugSchema.optional(),
  excerpt: boundedLocalizedText(500).optional().default({ en: "", no: "" }),
  seoTitle: boundedLocalizedText(200).optional(),
  seoDescription: boundedLocalizedText(300).optional(),
  coverImagePath: z.string().optional(),
  coverImageAlt: boundedLocalizedText(300).optional(),
  authorDisplayName: z.string().max(200).optional(),
  isPinned: z.boolean().optional(),
});

export const updateBlogPostMetadataSchema = z.object({
  title: boundedLocalizedText(200).optional(),
  slug: slugSchema.optional(),
  excerpt: boundedLocalizedText(500).optional(),
  seoTitle: boundedLocalizedText(200).nullable().optional(),
  seoDescription: boundedLocalizedText(300).nullable().optional(),
  noIndex: z.boolean().optional(),
  coverImagePath: z.string().nullable().optional(),
  coverImageAlt: boundedLocalizedText(300).nullable().optional(),
  authorDisplayName: z.string().max(200).nullable().optional(),
});

export const sectionTypeSchema = z.enum(BLOG_SECTION_TYPES);

export const sectionInputSchema = blogSectionDataSchema;

export const reorderSectionsSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      position: z.number().int().nonnegative(),
    }),
  )
  .min(1);
