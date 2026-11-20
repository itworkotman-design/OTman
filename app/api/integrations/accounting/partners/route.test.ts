import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ membershipFindManyMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { membership: { findMany: mocks.membershipFindManyMock } } }));

import { GET } from "./route";

const API_KEY = "accounting-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const saved = { ...process.env };

function get(key = API_KEY) {
  return GET(
    new Request("http://localhost/api/integrations/accounting/partners", {
      headers: { Authorization: `Bearer ${key}`, "X-Otman-Company-Id": COMPANY_ID },
    }),
  );
}

const membership = (id: string, role: string, permissions: string[], status = "ACTIVE") => ({
  id,
  role,
  status,
  user: { username: id, email: `${id}@example.no`, status: "ACTIVE" },
  permissions: permissions.map((permission) => ({ permission })),
});

describe("GET /api/integrations/accounting/partners", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ACCOUNTING_API_KEY = API_KEY;
    process.env.OTMAN_API_COMPANY_ID = COMPANY_ID;
  });

  afterAll(() => {
    process.env = { ...saved };
  });

  it("rejects a wrong key", async () => {
    const response = await get("wrong-key-wrong-key-wrong-key-wrong-key");
    expect(response.status).toBe(401);
    expect(mocks.membershipFindManyMock).not.toHaveBeenCalled();
  });

  it("lists the company's partner accounts, deactivated ones included, A–Z", async () => {
    mocks.membershipFindManyMock.mockResolvedValue([
      membership("NORDLINE AS", "USER", ["BOOKING_VIEW"]),
      membership("POWER Rud", "USER", ["BOOKING_VIEW", "BOOKING_CREATE"]),
      membership("Gordon Transport", "USER", ["BOOKING_VIEW"], "DISABLED"),
      membership("Otman admin", "ADMIN", ["BOOKING_VIEW"]),
    ]);

    const response = await get();

    expect(response.status).toBe(200);
    expect(mocks.membershipFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: COMPANY_ID } }));
    expect(await response.json()).toEqual({
      ok: true,
      partners: [
        { id: "Gordon Transport", name: "Gordon Transport", active: false },
        { id: "NORDLINE AS", name: "NORDLINE AS", active: true },
      ],
    });
  });
});
