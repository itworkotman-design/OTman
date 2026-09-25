import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reviewFindManyMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { review: { findMany: mocks.reviewFindManyMock } } }));

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

describe("GET /api/integrations/mcp/reviews/latest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OTMAN_API_KEY = API_KEY;
    process.env.OTMAN_API_COMPANY_ID = COMPANY_ID;
  });

  afterAll(() => {
    if (originalApiKey === undefined) delete process.env.OTMAN_API_KEY;
    else process.env.OTMAN_API_KEY = originalApiKey;
    if (originalCompanyId === undefined) delete process.env.OTMAN_API_COMPANY_ID;
    else process.env.OTMAN_API_COMPANY_ID = originalCompanyId;
  });

  it("returns the 6 most recent reviews without reviewer identity", async () => {
    mocks.reviewFindManyMock.mockResolvedValue([
      { rating: 5, comment: "Great service", createdAt: new Date("2026-09-20") },
    ]);

    const response = await GET(
      new Request("http://localhost/api/integrations/mcp/reviews/latest", {
        headers: { Authorization: `Bearer ${API_KEY}`, "X-Otman-Company-Id": COMPANY_ID },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.reviewFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 6 }),
    );
    const body = await response.json();
    expect(body.reviews).toHaveLength(1);
    expect(body.reviews[0]).not.toHaveProperty("email");
  });
});
