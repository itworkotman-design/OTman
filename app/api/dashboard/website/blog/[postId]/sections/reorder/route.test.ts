import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  blogSectionFindManyMock: vi.fn(),
  blogSectionUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    blogSection: {
      findMany: mocks.blogSectionFindManyMock,
      update: mocks.blogSectionUpdateMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) });
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
  mocks.transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({ blogSection: { update: mocks.blogSectionUpdateMock } }),
  );
});

describe("POST /api/dashboard/website/blog/[postId]/sections/reorder", () => {
  it("rejects a reorder payload that doesn't match the post's actual sections", async () => {
    mocks.blogSectionFindManyMock.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);

    const res = await POST(makeRequest([{ id: "a", position: 0 }, { id: "b", position: 1 }]), {
      params: Promise.resolve({ postId: "post-1" }),
    });
    expect(res.status).toBe(422);
  });

  it("rejects a reorder payload containing a section id from a different post", async () => {
    mocks.blogSectionFindManyMock.mockResolvedValue([{ id: "a" }, { id: "b" }]);

    const res = await POST(
      makeRequest([{ id: "a", position: 0 }, { id: "not-in-this-post", position: 1 }]),
      { params: Promise.resolve({ postId: "post-1" }) },
    );
    expect(res.status).toBe(422);
  });

  it("applies the reorder transactionally when the full section set matches", async () => {
    mocks.blogSectionFindManyMock
      .mockResolvedValueOnce([{ id: "a" }, { id: "b" }])
      .mockResolvedValueOnce([
        { id: "b", position: 0 },
        { id: "a", position: 1 },
      ]);

    const res = await POST(makeRequest([{ id: "b", position: 0 }, { id: "a", position: 1 }]), {
      params: Promise.resolve({ postId: "post-1" }),
    });
    expect(res.status).toBe(200);
    expect(mocks.transactionMock).toHaveBeenCalledTimes(1);
  });
});
