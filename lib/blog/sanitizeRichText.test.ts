import { describe, expect, it } from "vitest";
import { sanitizeBlogHtml } from "./sanitizeRichText";

describe("sanitizeBlogHtml", () => {
  it("strips script tags", () => {
    const result = sanitizeBlogHtml('<p>hi</p><script>alert(1)</script>');
    expect(result).not.toContain("<script>");
    expect(result).toContain("<p>hi</p>");
  });

  it("strips event handler attributes", () => {
    const result = sanitizeBlogHtml('<p onclick="alert(1)">hi</p>');
    expect(result).not.toContain("onclick");
  });

  it("keeps allowed formatting tags", () => {
    const result = sanitizeBlogHtml("<p><strong>bold</strong> and <em>italic</em></p>");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
  });

  it("keeps safe links but strips javascript: URLs", () => {
    const safe = sanitizeBlogHtml('<a href="https://example.com">link</a>');
    expect(safe).toContain('href="https://example.com"');

    const unsafe = sanitizeBlogHtml('<a href="javascript:alert(1)">link</a>');
    expect(unsafe).not.toContain("javascript:");
  });

  it("returns an empty string for empty input", () => {
    expect(sanitizeBlogHtml("")).toBe("");
  });
});
