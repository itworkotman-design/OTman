import { describe, expect, it } from "vitest";
import { tagNameSchema, updatePostTagsSchema } from "./blogTagSchemas";

describe("tagNameSchema", () => {
  it("accepts a normal tag name", () => {
    expect(tagNameSchema.safeParse("car").success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const result = tagNameSchema.safeParse("  car  ");
    expect(result.success && result.data).toBe("car");
  });

  it("rejects an empty tag name", () => {
    expect(tagNameSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects a tag name longer than 40 characters", () => {
    expect(tagNameSchema.safeParse("a".repeat(41)).success).toBe(false);
  });
});

describe("updatePostTagsSchema", () => {
  it("accepts an empty tag list", () => {
    expect(updatePostTagsSchema.safeParse({ tagNames: [] }).success).toBe(true);
  });

  it("accepts up to 20 tags", () => {
    const tagNames = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
    expect(updatePostTagsSchema.safeParse({ tagNames }).success).toBe(true);
  });

  it("rejects more than 20 tags", () => {
    const tagNames = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    expect(updatePostTagsSchema.safeParse({ tagNames }).success).toBe(false);
  });
});
