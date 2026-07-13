import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  countMock: vi.fn(),
  findFirstMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      findMany: mocks.findManyMock,
      count: mocks.countMock,
      findFirst: mocks.findFirstMock,
    },
  },
}));

import { getPublishedBlogPosts, getPublishedBlogPostBySlug } from "./publicBlogQueries";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPublishedBlogPosts", () => {
  it("only queries PUBLISHED posts", async () => {
    mocks.countMock.mockResolvedValue(0);
    mocks.findManyMock.mockResolvedValue([]);

    await getPublishedBlogPosts({ locale: "en" });

    expect(mocks.countMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "PUBLISHED" }) }),
    );
    expect(mocks.findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "PUBLISHED" }) }),
    );
  });

  it("orders pinned posts first (nulls last) then by createdAt", async () => {
    mocks.countMock.mockResolvedValue(0);
    mocks.findManyMock.mockResolvedValue([]);

    await getPublishedBlogPosts({ locale: "en" });

    const call = mocks.findManyMock.mock.calls[0][0];
    expect(call.orderBy).toEqual([
      { pinnedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ]);
  });
});

describe("getPublishedBlogPostBySlug", () => {
  it("returns null when the post does not exist or is not published", async () => {
    mocks.findFirstMock.mockResolvedValue(null);
    const result = await getPublishedBlogPostBySlug("missing");
    expect(result).toBeNull();
    expect(mocks.findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "missing", status: "PUBLISHED" } }),
    );
  });
});
