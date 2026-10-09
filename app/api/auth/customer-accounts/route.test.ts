import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireWebsiteUsersAdmin: vi.fn(), listCompanyCustomerAccounts: vi.fn() }));

vi.mock("@/lib/customerAccounts/requireWebsiteUsersAdmin", () => ({ requireWebsiteUsersAdmin: mocks.requireWebsiteUsersAdmin }));
vi.mock("@/lib/customerAccounts/adminCustomerAccounts", () => ({ listCompanyCustomerAccounts: mocks.listCompanyCustomerAccounts }));

import { GET } from "./route";

const actor = { membershipId: "m1", name: "Admin", email: "a@otman.no", source: "USER" };

describe("GET /api/auth/customer-accounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists the company's website logins for a user-management admin", async () => {
    mocks.requireWebsiteUsersAdmin.mockResolvedValue({ ok: true, companyId: "c1", actor });
    mocks.listCompanyCustomerAccounts.mockResolvedValue([{ id: "a1" }]);

    const res = await GET(new Request("http://x/api/auth/customer-accounts"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, accounts: [{ id: "a1" }] });
    expect(mocks.listCompanyCustomerAccounts).toHaveBeenCalledWith("c1");
  });

  it("refuses anyone else with the helper's answer", async () => {
    mocks.requireWebsiteUsersAdmin.mockResolvedValue({ ok: false, status: 403, reason: "FORBIDDEN" });

    const res = await GET(new Request("http://x/api/auth/customer-accounts"));

    expect(res.status).toBe(403);
    expect(mocks.listCompanyCustomerAccounts).not.toHaveBeenCalled();
  });
});
