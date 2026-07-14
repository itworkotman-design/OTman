import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  blogTagFindUniqueMock: vi.fn(),
  blogTagUpdateMock: vi.fn(),
  blogTagDeleteMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    blogTag: {
      findUnique: mocks.blogTagFindUniqueMock,
      update: mocks.blogTagUpdateMock,
      delete: mocks.blogTagDeleteMock,
    },
  },
}));

import { PATCH, DELETE } from "./route";

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

describe("PATCH/DELETE /api/dashboard/website/blog/tags/[tagId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an empty tag name on PATCH", async () => {
    mockMembership("ADMIN");

    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: JSON.stringify({ name: "" }) }),
      { params: Promise.resolve({ tagId: "tag-1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when renaming a missing tag", async () => {
    mockMembership("ADMIN");
    mocks.blogTagFindUniqueMock.mockResolvedValue(null);

    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: JSON.stringify({ name: "Cars" }) }),
      { params: Promise.resolve({ tagId: "missing" }) },
    );
    expect(res.status).toBe(404);
  });

  it("renames an existing tag", async () => {
    mockMembership("ADMIN");
    mocks.blogTagFindUniqueMock.mockResolvedValue({ id: "tag-1", name: "Car" });
    mocks.blogTagUpdateMock.mockResolvedValue({ id: "tag-1", name: "Cars" });

    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: JSON.stringify({ name: "Cars" }) }),
      { params: Promise.resolve({ tagId: "tag-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mocks.blogTagUpdateMock).toHaveBeenCalledWith({ where: { id: "tag-1" }, data: { name: "Cars" } });
  });

  it("returns 404 when deleting a missing tag", async () => {
    mockMembership("ADMIN");
    mocks.blogTagFindUniqueMock.mockResolvedValue(null);

    const res = await DELETE(makeRequest("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ tagId: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes an existing tag", async () => {
    mockMembership("ADMIN");
    mocks.blogTagFindUniqueMock.mockResolvedValue({ id: "tag-1" });

    const res = await DELETE(makeRequest("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ tagId: "tag-1" }),
    });
    expect(res.status).toBe(200);
    expect(mocks.blogTagDeleteMock).toHaveBeenCalledWith({ where: { id: "tag-1" } });
  });
});
