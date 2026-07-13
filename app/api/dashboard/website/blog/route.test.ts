import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  blogPostFindManyMock: vi.fn(),
  blogPostCountMock: vi.fn(),
  blogPostGroupByMock: vi.fn(),
  blogPostFindUniqueMock: vi.fn(),
  blogPostCreateMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    blogPost: {
      findMany: mocks.blogPostFindManyMock,
      count: mocks.blogPostCountMock,
      groupBy: mocks.blogPostGroupByMock,
      findUnique: mocks.blogPostFindUniqueMock,
      create: mocks.blogPostCreateMock,
    },
  },
}));

import { GET, POST } from "./route";

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe("GET/POST /api/dashboard/website/blog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no session", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost/api/dashboard/website/blog"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the active membership role is USER", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirstMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "USER",
      membershipPriceLists: [],
      permissions: [],
    });

    const res = await GET(makeRequest("http://localhost/api/dashboard/website/blog"));
    expect(res.status).toBe(403);
  });

  it("allows ADMIN to list posts", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirstMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "ADMIN",
      membershipPriceLists: [],
      permissions: [],
    });
    mocks.blogPostCountMock.mockResolvedValue(0);
    mocks.blogPostFindManyMock.mockResolvedValue([]);
    mocks.blogPostGroupByMock.mockResolvedValue([]);

    const res = await GET(makeRequest("http://localhost/api/dashboard/website/blog"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("rejects creating a post with an invalid body", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirstMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "ADMIN",
      membershipPriceLists: [],
      permissions: [],
    });

    const res = await POST(
      makeRequest("http://localhost/api/dashboard/website/blog", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects creating a post whose explicit slug is already taken", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirstMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "ADMIN",
      membershipPriceLists: [],
      permissions: [],
    });
    mocks.blogPostFindUniqueMock.mockResolvedValue({ id: "existing-post" });

    const res = await POST(
      makeRequest("http://localhost/api/dashboard/website/blog", {
        method: "POST",
        body: JSON.stringify({ title: { en: "Hello", no: "Hei" }, slug: "hello" }),
      }),
    );
    expect(res.status).toBe(409);
  });

  it("creates a draft post with the current user as author", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirstMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "OWNER",
      membershipPriceLists: [],
      permissions: [],
    });
    mocks.blogPostFindUniqueMock.mockResolvedValue(null);
    mocks.blogPostCreateMock.mockResolvedValue({ id: "new-post", status: "DRAFT" });

    const res = await POST(
      makeRequest("http://localhost/api/dashboard/website/blog", {
        method: "POST",
        body: JSON.stringify({ title: { en: "Hello", no: "Hei" } }),
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.blogPostCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: "u1", status: "DRAFT" }),
      }),
    );
  });
});
