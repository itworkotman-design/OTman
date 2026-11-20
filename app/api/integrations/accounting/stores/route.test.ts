import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ membershipFindManyMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { membership: { findMany: mocks.membershipFindManyMock } } }));

import { GET } from "./route";

const API_KEY = "accounting-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const saved = { ...process.env };

function get(key = API_KEY) {
  return GET(
    new Request("http://localhost/api/integrations/accounting/stores", {
      headers: { Authorization: `Bearer ${key}`, "X-Otman-Company-Id": COMPANY_ID },
    }),
  );
}

const membership = (id: string, role: string, permissions: string[], extra: { status?: string; userStatus?: string; username?: string | null } = {}) => ({
  id,
  role,
  status: extra.status ?? "ACTIVE",
  user: { username: extra.username === undefined ? id : extra.username, email: `${id}@example.no`, status: extra.userStatus ?? "ACTIVE" },
  permissions: permissions.map((permission) => ({ permission })),
});

describe("GET /api/integrations/accounting/stores", () => {
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

  it("lists the company's order creators, deactivated ones included, A–Z", async () => {
    mocks.membershipFindManyMock.mockResolvedValue([
      membership("POWER Rud", "USER", ["BOOKING_VIEW", "BOOKING_CREATE"]),
      membership("NORDLINE AS", "USER", ["BOOKING_VIEW"]),
      membership("Otman admin", "ADMIN", []),
      membership("ELKJØP Lørenskog", "USER", ["BOOKING_VIEW", "BOOKING_CREATE"], { status: "DISABLED" }),
      membership("Viewer only", "USER", []),
      membership("m-email", "USER", ["BOOKING_VIEW", "BOOKING_CREATE"], { username: null }),
    ]);

    const response = await get();

    expect(response.status).toBe(200);
    expect(mocks.membershipFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: COMPANY_ID } }));
    expect(await response.json()).toEqual({
      ok: true,
      stores: [
        { id: "ELKJØP Lørenskog", name: "ELKJØP Lørenskog", active: false },
        { id: "m-email", name: "m-email@example.no", active: true },
        { id: "Otman admin", name: "Otman admin", active: true },
        { id: "POWER Rud", name: "POWER Rud", active: true },
      ],
    });
  });

  it("answers 503 when the database fails", async () => {
    mocks.membershipFindManyMock.mockRejectedValue(new Error("down"));
    const response = await get();
    expect(response.status).toBe(503);
  });
});
