import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  blogTagFindUniqueMock: vi.fn(),
  mergeBlogTagsMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    blogTag: { findUnique: mocks.blogTagFindUniqueMock },
  },
}));

vi.mock("@/lib/blog/blogTags", () => ({
  mergeBlogTags: mocks.mergeBlogTagsMock,
}));

import { POST } from "./route";

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

describe("POST /api/dashboard/website/blog/tags/[tagId]/merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects merging a tag into itself", async () => {
    mockMembership("ADMIN");

    const res = await POST(
      makeRequest("http://localhost/x", { method: "POST", body: JSON.stringify({ intoTagId: "tag-1" }) }),
      { params: Promise.resolve({ tagId: "tag-1" }) },
    );
    expect(res.status).toBe(400);
    expect(mocks.mergeBlogTagsMock).not.toHaveBeenCalled();
  });

  it("returns 404 when either tag is missing", async () => {
    mockMembership("ADMIN");
    mocks.blogTagFindUniqueMock.mockResolvedValueOnce({ id: "tag-1" }).mockResolvedValueOnce(null);

    const res = await POST(
      makeRequest("http://localhost/x", { method: "POST", body: JSON.stringify({ intoTagId: "tag-2" }) }),
      { params: Promise.resolve({ tagId: "tag-1" }) },
    );
    expect(res.status).toBe(404);
    expect(mocks.mergeBlogTagsMock).not.toHaveBeenCalled();
  });

  it("merges the source tag into the target tag", async () => {
    mockMembership("ADMIN");
    mocks.blogTagFindUniqueMock.mockResolvedValueOnce({ id: "tag-1" }).mockResolvedValueOnce({ id: "tag-2" });

    const res = await POST(
      makeRequest("http://localhost/x", { method: "POST", body: JSON.stringify({ intoTagId: "tag-2" }) }),
      { params: Promise.resolve({ tagId: "tag-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mocks.mergeBlogTagsMock).toHaveBeenCalledWith("tag-1", "tag-2");
  });
});
