import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  blogPostTagFindManyMock: vi.fn(),
  blogPostTagUpsertMock: vi.fn(),
  blogPostTagDeleteManyMock: vi.fn(),
  blogTagDeleteMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPostTag: {
      findMany: mocks.blogPostTagFindManyMock,
      upsert: mocks.blogPostTagUpsertMock,
      deleteMany: mocks.blogPostTagDeleteManyMock,
    },
    blogTag: {
      delete: mocks.blogTagDeleteMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { mergeBlogTags } from "./blogTags";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<void>) =>
    callback({
      blogPostTag: { upsert: mocks.blogPostTagUpsertMock, deleteMany: mocks.blogPostTagDeleteManyMock },
      blogTag: { delete: mocks.blogTagDeleteMock },
    }),
  );
});

describe("mergeBlogTags", () => {
  it("reassigns every post from the source tag onto the target tag", async () => {
    mocks.blogPostTagFindManyMock.mockResolvedValue([
      { blogPostId: "post-1", blogTagId: "source" },
      { blogPostId: "post-2", blogTagId: "source" },
    ]);

    await mergeBlogTags("source", "target");

    expect(mocks.blogPostTagUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { blogPostId_blogTagId: { blogPostId: "post-1", blogTagId: "target" } },
        create: { blogPostId: "post-1", blogTagId: "target" },
      }),
    );
    expect(mocks.blogPostTagUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { blogPostId_blogTagId: { blogPostId: "post-2", blogTagId: "target" } },
        create: { blogPostId: "post-2", blogTagId: "target" },
      }),
    );
  });

  it("deletes the source tag's join rows and the tag itself", async () => {
    mocks.blogPostTagFindManyMock.mockResolvedValue([]);

    await mergeBlogTags("source", "target");

    expect(mocks.blogPostTagDeleteManyMock).toHaveBeenCalledWith({ where: { blogTagId: "source" } });
    expect(mocks.blogTagDeleteMock).toHaveBeenCalledWith({ where: { id: "source" } });
  });
});
