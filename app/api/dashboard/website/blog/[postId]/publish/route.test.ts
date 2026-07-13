import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  blogPostFindUniqueMock: vi.fn(),
  blogPostUpdateMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    blogPost: {
      findUnique: mocks.blogPostFindUniqueMock,
      update: mocks.blogPostUpdateMock,
    },
  },
}));

import { POST } from "./route";

function makeRequest() {
  return new Request("http://localhost/x", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
  mocks.membershipFindFirstMock.mockResolvedValue({
    userId: "u1",
    companyId: "c1",
    role: "ADMIN",
    membershipPriceLists: [],
    permissions: [],
  });
});

describe("POST /api/dashboard/website/blog/[postId]/publish", () => {
  it("rejects publishing a post with no title, invalid slug, and no content", async () => {
    mocks.blogPostFindUniqueMock.mockResolvedValue({
      id: "post-1",
      title: { en: "", no: "" },
      slug: "Not A Valid Slug!",
      publishedAt: null,
      sections: [],
    });

    const res = await POST(makeRequest(), { params: Promise.resolve({ postId: "post-1" }) });
    expect(res.status).toBe(422);
    expect(mocks.blogPostUpdateMock).not.toHaveBeenCalled();
  });

  it("publishes a valid post and sets publishedAt for the first time", async () => {
    mocks.blogPostFindUniqueMock.mockResolvedValue({
      id: "post-1",
      title: { en: "Hello", no: "" },
      slug: "hello",
      publishedAt: null,
      sections: [{ type: "RICH_TEXT", data: { html: { en: "<p>hi</p>", no: "" } } }],
    });
    mocks.blogPostUpdateMock.mockResolvedValue({ id: "post-1", status: "PUBLISHED" });

    const res = await POST(makeRequest(), { params: Promise.resolve({ postId: "post-1" }) });
    expect(res.status).toBe(200);
    expect(mocks.blogPostUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
    const call = mocks.blogPostUpdateMock.mock.calls[0][0];
    expect(call.data.publishedAt).toBeInstanceOf(Date);
  });

  it("does not reset publishedAt when republishing an already-published post", async () => {
    const originalDate = new Date("2026-01-01T00:00:00.000Z");
    mocks.blogPostFindUniqueMock.mockResolvedValue({
      id: "post-1",
      title: { en: "Hello", no: "" },
      slug: "hello",
      publishedAt: originalDate,
      sections: [{ type: "RICH_TEXT", data: { html: { en: "<p>hi</p>", no: "" } } }],
    });
    mocks.blogPostUpdateMock.mockResolvedValue({ id: "post-1", status: "PUBLISHED" });

    await POST(makeRequest(), { params: Promise.resolve({ postId: "post-1" }) });

    const call = mocks.blogPostUpdateMock.mock.calls[0][0];
    expect(call.data.publishedAt).toBe(originalDate);
  });
});
