import { describe, expect, it } from "vitest";
import { getSharedUserLogoKey, planUserLogoDedupe } from "./sharedUserLogo";

describe("getSharedUserLogoKey", () => {
  it("maps identical bytes to the same key regardless of extension case", () => {
    const a = getSharedUserLogoKey(Buffer.from([1, 2, 3]), ".PNG");
    const b = getSharedUserLogoKey(Buffer.from([1, 2, 3]), ".png");
    expect(a).toBe(b);
    expect(a).toMatch(/^orders\/user-logos\/shared\/[0-9a-f]{64}\.png$/);
  });
});

describe("planUserLogoDedupe", () => {
  it("moves every copy of the same picture onto one shared path", () => {
    const plan = planUserLogoDedupe([
      { logoPath: "s3://orders/user-logos/u1/1-a-otman.png", hash: "aaa" },
      { logoPath: "s3://orders/user-logos/u2/2-b-otman.png", hash: "aaa" },
      { logoPath: "s3://orders/user-logos/u3/3-c-arrow.webp", hash: "bbb" },
    ]);

    expect(plan).toEqual([
      {
        hash: "aaa",
        targetPath: "s3://orders/user-logos/shared/aaa.png",
        sourcePath: "s3://orders/user-logos/u1/1-a-otman.png",
        replacePaths: [
          "s3://orders/user-logos/u1/1-a-otman.png",
          "s3://orders/user-logos/u2/2-b-otman.png",
        ],
      },
      {
        hash: "bbb",
        targetPath: "s3://orders/user-logos/shared/bbb.webp",
        sourcePath: "s3://orders/user-logos/u3/3-c-arrow.webp",
        replacePaths: ["s3://orders/user-logos/u3/3-c-arrow.webp"],
      },
    ]);
  });

  it("skips pictures that are already on their shared path", () => {
    const plan = planUserLogoDedupe([
      { logoPath: "s3://orders/user-logos/shared/aaa.png", hash: "aaa" },
    ]);

    expect(plan).toEqual([]);
  });

  it("keeps an existing shared path as the target and folds old copies into it", () => {
    const plan = planUserLogoDedupe([
      { logoPath: "s3://orders/user-logos/u1/1-a-otman.jpeg", hash: "aaa" },
      { logoPath: "s3://orders/user-logos/shared/aaa.png", hash: "aaa" },
    ]);

    expect(plan).toEqual([
      {
        hash: "aaa",
        targetPath: "s3://orders/user-logos/shared/aaa.png",
        sourcePath: "s3://orders/user-logos/shared/aaa.png",
        replacePaths: ["s3://orders/user-logos/u1/1-a-otman.jpeg"],
      },
    ]);
  });
});
