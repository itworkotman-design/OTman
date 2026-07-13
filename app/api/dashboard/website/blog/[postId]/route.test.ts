import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  blogPostFindUniqueMock: vi.fn(),
  blogPostUpdateMock: vi.fn(),
  blogPostDeleteMock: vi.fn(),
  deleteAttachmentFileMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/orders/orderAttachmentStorage", () => ({
  deleteAttachmentFile: mocks.deleteAttachmentFileMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    blogPost: {
      findUnique: mocks.blogPostFindUniqueMock,
      update: mocks.blogPostUpdateMock,
      delete: mocks.blogPostDeleteMock,
    },
  },
}));

import { GET, PATCH, DELETE } from "./route";

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

function mockMembership(role: "OWNER" | "ADMIN" | "USER") {
  mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
  mocks.membershipFindFirstMock.mockResolvedValue({
    userId: "u1",
    companyId: "c1",
    role,
    membershipPriceLists: [],
    permissions: [],
  });
}

describe("GET/PATCH/DELETE /api/dashboard/website/blog/[postId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteAttachmentFileMock.mockResolvedValue(undefined);
  });

  it("returns 404 for a missing post on GET", async () => {
    mockMembership("ADMIN");
    mocks.blogPostFindUniqueMock.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost/x"), { params: Promise.resolve({ postId: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("rejects a slug change that collides with another post", async () => {
    mockMembership("ADMIN");
    mocks.blogPostFindUniqueMock
      .mockResolvedValueOnce({ id: "post-1", slug: "old-slug" })
      .mockResolvedValueOnce({ id: "post-2", slug: "taken-slug" });

    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: JSON.stringify({ slug: "taken-slug" }) }),
      { params: Promise.resolve({ postId: "post-1" }) },
    );
    expect(res.status).toBe(409);
  });

  it("forbids DELETE for an ADMIN (owner-only)", async () => {
    mockMembership("ADMIN");

    const res = await DELETE(makeRequest("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ postId: "post-1" }),
    });
    expect(res.status).toBe(403);
    expect(mocks.blogPostDeleteMock).not.toHaveBeenCalled();
  });

  it("allows DELETE for an OWNER and cleans up section images", async () => {
    mockMembership("OWNER");
    mocks.blogPostFindUniqueMock.mockResolvedValue({
      id: "post-1",
      coverImagePath: "s3://cover.png",
      sections: [{ data: { storagePath: "s3://section.png" } }],
    });
    mocks.blogPostDeleteMock.mockResolvedValue({});

    const res = await DELETE(makeRequest("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ postId: "post-1" }),
    });
    expect(res.status).toBe(200);
    expect(mocks.blogPostDeleteMock).toHaveBeenCalledWith({ where: { id: "post-1" } });
    expect(mocks.deleteAttachmentFileMock).toHaveBeenCalledWith("s3://cover.png");
    expect(mocks.deleteAttachmentFileMock).toHaveBeenCalledWith("s3://section.png");
  });
});
