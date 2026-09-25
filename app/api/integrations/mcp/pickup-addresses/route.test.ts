import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ addressFindManyMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { customPickupAddress: { findMany: mocks.addressFindManyMock } } }));

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

describe("GET /api/integrations/mcp/pickup-addresses", () => {
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

  it("returns active addresses without assigned-user identities", async () => {
    mocks.addressFindManyMock.mockResolvedValue([
      { name: "Main warehouse", address: "Storgata 1", latitude: 59.9, longitude: 10.7, phone: "12345678" },
    ]);

    const response = await GET(
      new Request("http://localhost/api/integrations/mcp/pickup-addresses", {
        headers: { Authorization: `Bearer ${API_KEY}`, "X-Otman-Company-Id": COMPANY_ID },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.addressFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    const body = await response.json();
    expect(body.pickupAddresses[0]).not.toHaveProperty("id");
  });
});
