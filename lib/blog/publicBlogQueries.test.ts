import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  countMock: vi.fn(),
  findFirstMock: vi.fn(),
  tagFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      findMany: mocks.findManyMock,
      count: mocks.countMock,
      findFirst: mocks.findFirstMock,
    },
    blogTag: {
      findMany: mocks.tagFindManyMock,
    },
  },
}));

import {
  getPublishedBlogPosts,
  getPublishedBlogPostBySlug,
  getRelatedBlogPosts,
  getPublishedBlogTags,
} from "./publicBlogQueries";

const EMPTY = { en: "", no: "" };

function makePost(overrides: Partial<Record<string, unknown>> & { id: string; tagSlugs?: string[] }) {
  const { id, tagSlugs = [], ...rest } = overrides;
  return {
    id,
    slug: id,
    title: EMPTY,
    excerpt: EMPTY,
    coverImagePath: null,
    coverImageAlt: null,
    isPinned: false,
    pinnedAt: null,
    publishedAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    authorDisplayName: null,
    author: null,
    sections: [],
    tags: tagSlugs.map((slug) => ({ blogTag: { name: slug, slug } })),
    ...rest,
  };
}

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

  it("filters by tagSlug when provided", async () => {
    mocks.countMock.mockResolvedValue(0);
    mocks.findManyMock.mockResolvedValue([]);

    await getPublishedBlogPosts({ locale: "en", tagSlug: "car" });

    expect(mocks.findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tags: { some: { blogTag: { slug: "car" } } } }),
      }),
    );
  });

  it("omits the tag filter when tagSlug is not provided", async () => {
    mocks.countMock.mockResolvedValue(0);
    mocks.findManyMock.mockResolvedValue([]);

    await getPublishedBlogPosts({ locale: "en" });

    const call = mocks.findManyMock.mock.calls[0][0];
    expect(call.where.tags).toBeUndefined();
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

describe("getRelatedBlogPosts", () => {
  it("ranks tag-overlap candidates by match count before filling with recent posts", async () => {
    mocks.findManyMock
      .mockResolvedValueOnce([
        makePost({ id: "one-match", tagSlugs: ["car"] }),
        makePost({ id: "two-match", tagSlugs: ["car", "money"] }),
      ])
      .mockResolvedValueOnce([makePost({ id: "filler" })]);

    const result = await getRelatedBlogPosts({
      excludePostId: "current",
      tagSlugs: ["car", "money"],
      limit: 3,
    });

    expect(result.map((p) => p.id)).toEqual(["two-match", "one-match", "filler"]);
  });

  it("skips the tag-overlap query entirely when the post has no tags", async () => {
    mocks.findManyMock.mockResolvedValueOnce([makePost({ id: "filler" })]);

    const result = await getRelatedBlogPosts({ excludePostId: "current", limit: 3 });

    expect(mocks.findManyMock).toHaveBeenCalledTimes(1);
    expect(result.map((p) => p.id)).toEqual(["filler"]);
  });
});

describe("getPublishedBlogTags", () => {
  it("only returns tags used by at least one published post", async () => {
    mocks.tagFindManyMock.mockResolvedValue([{ name: "Car", slug: "car" }]);

    const tags = await getPublishedBlogTags();

    expect(mocks.tagFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { posts: { some: { blogPost: { status: "PUBLISHED" } } } },
      }),
    );
    expect(tags).toEqual([{ name: "Car", slug: "car" }]);
  });
});
