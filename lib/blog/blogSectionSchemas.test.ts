import { describe, expect, it } from "vitest";
import { blogSectionDataSchema, isSectionNonEmpty } from "./blogSectionSchemas";

const EMPTY = { en: "", no: "" };

describe("blogSectionDataSchema", () => {
  it("accepts a valid RICH_TEXT section", () => {
    const result = blogSectionDataSchema.safeParse({
      type: "RICH_TEXT",
      html: { en: "<p>hi</p>", no: "<p>hei</p>" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a section with an unknown type", () => {
    const result = blogSectionDataSchema.safeParse({ type: "VIDEO", url: "x" });
    expect(result.success).toBe(false);
  });

  it("accepts an IMAGE section with an empty storagePath (not yet uploaded)", () => {
    const result = blogSectionDataSchema.safeParse({
      type: "IMAGE",
      storagePath: "",
      alt: EMPTY,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a GALLERY section with more than 12 images", () => {
    const images = Array.from({ length: 13 }, () => ({ storagePath: "s3://x", alt: EMPTY }));
    const result = blogSectionDataSchema.safeParse({ type: "GALLERY", columns: 2, images });
    expect(result.success).toBe(false);
  });

  it("rejects a GALLERY section with an invalid column count", () => {
    const result = blogSectionDataSchema.safeParse({ type: "GALLERY", columns: 4, images: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a CTA section with an invalid button URL", () => {
    const result = blogSectionDataSchema.safeParse({
      type: "CTA",
      buttonLabel: { en: "Go", no: "Gå" },
      buttonUrl: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a CTA section with a root-relative button URL", () => {
    const result = blogSectionDataSchema.safeParse({
      type: "CTA",
      buttonLabel: { en: "Go", no: "Gå" },
      buttonUrl: "/blogg",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a title/excerpt longer than the allowed length", () => {
    const result = blogSectionDataSchema.safeParse({
      type: "QUOTE",
      quote: { en: "a".repeat(501), no: "b" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an IMAGE_TEXT section missing imagePosition", () => {
    const result = blogSectionDataSchema.safeParse({
      type: "IMAGE_TEXT",
      storagePath: "s3://x",
      alt: EMPTY,
      html: EMPTY,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a CAROUSEL section with no images yet (not uploaded)", () => {
    const result = blogSectionDataSchema.safeParse({ type: "CAROUSEL", images: [] });
    expect(result.success).toBe(true);
  });

  it("accepts a CAROUSEL section with autoplay and a valid interval", () => {
    const result = blogSectionDataSchema.safeParse({
      type: "CAROUSEL",
      images: [{ storagePath: "s3://x", alt: EMPTY }],
      autoplay: true,
      intervalSeconds: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a CAROUSEL section with more than 12 images", () => {
    const images = Array.from({ length: 13 }, () => ({ storagePath: "s3://x", alt: EMPTY }));
    const result = blogSectionDataSchema.safeParse({ type: "CAROUSEL", images });
    expect(result.success).toBe(false);
  });

  it("rejects a CAROUSEL section with an out-of-range interval", () => {
    const result = blogSectionDataSchema.safeParse({
      type: "CAROUSEL",
      images: [],
      autoplay: true,
      intervalSeconds: 60,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a section with a valid backgroundColor", () => {
    const result = blogSectionDataSchema.safeParse({
      type: "RICH_TEXT",
      html: EMPTY,
      backgroundColor: "#ff00aa",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a section with no backgroundColor set", () => {
    const result = blogSectionDataSchema.safeParse({ type: "RICH_TEXT", html: EMPTY });
    expect(result.success).toBe(true);
  });

  it("rejects a section with an invalid backgroundColor", () => {
    const result = blogSectionDataSchema.safeParse({
      type: "RICH_TEXT",
      html: EMPTY,
      backgroundColor: "not-a-color",
    });
    expect(result.success).toBe(false);
  });
});

describe("isSectionNonEmpty", () => {
  it("treats an empty rich text section as empty", () => {
    expect(isSectionNonEmpty({ type: "RICH_TEXT", html: EMPTY })).toBe(false);
  });

  it("treats a rich text section with content as non-empty", () => {
    expect(isSectionNonEmpty({ type: "RICH_TEXT", html: { en: "<p>hi</p>", no: "" } })).toBe(true);
  });

  it("treats an empty gallery as empty", () => {
    expect(isSectionNonEmpty({ type: "GALLERY", columns: 2, images: [] })).toBe(false);
  });

  it("treats an empty carousel as empty", () => {
    expect(isSectionNonEmpty({ type: "CAROUSEL", images: [] })).toBe(false);
  });

  it("treats a carousel with at least one image as non-empty", () => {
    expect(isSectionNonEmpty({ type: "CAROUSEL", images: [{ storagePath: "s3://x", alt: EMPTY }] })).toBe(true);
  });

  it("treats a divider as always non-empty", () => {
    expect(isSectionNonEmpty({ type: "DIVIDER", style: "solid" })).toBe(true);
  });
});
