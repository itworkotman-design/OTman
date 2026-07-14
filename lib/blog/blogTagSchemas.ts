import { z } from "zod";

export const tagNameSchema = z.string().trim().min(1, "Tag name is required").max(40);

export const updatePostTagsSchema = z.object({
  tagNames: z.array(tagNameSchema).max(20),
});

export const renameTagSchema = z.object({
  name: tagNameSchema,
});

export const mergeTagSchema = z.object({
  intoTagId: z.string().min(1),
});
