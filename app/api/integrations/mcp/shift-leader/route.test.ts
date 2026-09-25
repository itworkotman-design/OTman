import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ shiftLeaderFindUniqueMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { shiftLeader: { findUnique: mocks.shiftLeaderFindUniqueMock } } }));

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

function createRequest() {
  return GET(
    new Request("http://localhost/api/integrations/mcp/shift-leader", {
      headers: { Authorization: `Bearer ${API_KEY}`, "X-Otman-Company-Id": COMPANY_ID },
    }),
  );
}

describe("GET /api/integrations/mcp/shift-leader", () => {
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

  it("returns null when no shift leader is set for today", async () => {
    mocks.shiftLeaderFindUniqueMock.mockResolvedValue(null);

    const response = await createRequest();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ shiftLeader: null });
  });

  it("returns null when the stored record is from a previous day", async () => {
    mocks.shiftLeaderFindUniqueMock.mockResolvedValue({
      userId: "u1",
      username: "jane",
      date: "2020-01-01",
    });

    const response = await createRequest();

    await expect(response.json()).resolves.toEqual({ shiftLeader: null });
  });

  it("returns today's shift leader without the internal userId", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mocks.shiftLeaderFindUniqueMock.mockResolvedValue({
      userId: "u1",
      username: "jane",
      date: today,
    });

    const response = await createRequest();

    await expect(response.json()).resolves.toEqual({
      shiftLeader: { username: "jane" },
    });
  });
});
