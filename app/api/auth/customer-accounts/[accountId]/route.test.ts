import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireWebsiteUsersAdmin: vi.fn(),
  findManageableCustomerAccount: vi.fn(),
  setCustomerAccountPassword: vi.fn(),
  sendNewCustomerPassword: vi.fn(),
  changeCustomerAccountEmail: vi.fn(),
  signOutCustomerAccount: vi.fn(),
  deleteCustomerAccount: vi.fn(),
}));

vi.mock("@/lib/customerAccounts/requireWebsiteUsersAdmin", () => ({ requireWebsiteUsersAdmin: mocks.requireWebsiteUsersAdmin }));
vi.mock("@/lib/customerAccounts/adminCustomerAccounts", () => ({
  findManageableCustomerAccount: mocks.findManageableCustomerAccount,
  setCustomerAccountPassword: mocks.setCustomerAccountPassword,
  sendNewCustomerPassword: mocks.sendNewCustomerPassword,
  changeCustomerAccountEmail: mocks.changeCustomerAccountEmail,
  signOutCustomerAccount: mocks.signOutCustomerAccount,
  deleteCustomerAccount: mocks.deleteCustomerAccount,
}));

import { DELETE, PATCH } from "./route";

const actor = { membershipId: "m1", name: "Admin", email: "a@otman.no", source: "USER" };
const account = { id: "a1", email: "ola@example.com" };
const ctx = { params: Promise.resolve({ accountId: "a1" }) };
const patch = (body: unknown) =>
  PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }), ctx);

describe("/api/auth/customer-accounts/[accountId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireWebsiteUsersAdmin.mockResolvedValue({ ok: true, companyId: "c1", actor });
    mocks.findManageableCustomerAccount.mockResolvedValue({ ok: true, account });
  });

  it("refuses a non-admin before touching the account", async () => {
    mocks.requireWebsiteUsersAdmin.mockResolvedValue({ ok: false, status: 403, reason: "FORBIDDEN" });

    expect((await patch({ action: "signOut" })).status).toBe(403);
    expect(mocks.findManageableCustomerAccount).not.toHaveBeenCalled();
  });

  it("is 404 for an account without orders here, and 409 for one shared with another company", async () => {
    mocks.findManageableCustomerAccount.mockResolvedValue({ ok: false, reason: "NOT_FOUND" });
    expect((await patch({ action: "signOut" })).status).toBe(404);

    mocks.findManageableCustomerAccount.mockResolvedValue({ ok: false, reason: "SHARED_ACCOUNT" });
    const res = await patch({ action: "signOut" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "SHARED_ACCOUNT" });
    expect(mocks.findManageableCustomerAccount).toHaveBeenCalledWith("c1", "a1");
  });

  it("sets a password", async () => {
    mocks.setCustomerAccountPassword.mockResolvedValue({ ok: true });

    expect((await patch({ action: "setPassword", password: "a-new-pass" })).status).toBe(200);
    expect(mocks.setCustomerAccountPassword).toHaveBeenCalledWith({ account, password: "a-new-pass", actor });
  });

  it("answers 422 for a too-short password", async () => {
    mocks.setCustomerAccountPassword.mockResolvedValue({ ok: false, reason: "PASSWORD_TOO_SHORT" });

    expect((await patch({ action: "setPassword", password: "x" })).status).toBe(422);
  });

  it("emails a new password, 502 when the email fails", async () => {
    mocks.sendNewCustomerPassword.mockResolvedValue({ ok: true });
    expect((await patch({ action: "sendNewPassword" })).status).toBe(200);

    mocks.sendNewCustomerPassword.mockResolvedValue({ ok: false, reason: "EMAIL_FAILED" });
    expect((await patch({ action: "sendNewPassword" })).status).toBe(502);
  });

  it("changes the email, 409 when it is taken", async () => {
    mocks.changeCustomerAccountEmail.mockResolvedValue({ ok: true, email: "kari@example.com" });
    const res = await patch({ action: "changeEmail", email: "kari@example.com" });
    expect(await res.json()).toEqual({ ok: true, email: "kari@example.com" });
    expect(mocks.changeCustomerAccountEmail).toHaveBeenCalledWith({ account, companyId: "c1", email: "kari@example.com", actor });

    mocks.changeCustomerAccountEmail.mockResolvedValue({ ok: false, reason: "EMAIL_TAKEN" });
    expect((await patch({ action: "changeEmail", email: "x@example.com" })).status).toBe(409);
  });

  it("signs out", async () => {
    expect((await patch({ action: "signOut" })).status).toBe(200);
    expect(mocks.signOutCustomerAccount).toHaveBeenCalledWith({ account, actor });
  });

  it("refuses an unknown action or a bad body", async () => {
    expect((await patch({ action: "explode" })).status).toBe(400);
    expect((await patch({ action: "setPassword" })).status).toBe(400);
    expect((await PATCH(new Request("http://x", { method: "PATCH", body: "nope" }), ctx)).status).toBe(400);
  });

  it("deletes the login", async () => {
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), ctx);

    expect(res.status).toBe(200);
    expect(mocks.deleteCustomerAccount).toHaveBeenCalledWith({ account, actor });
  });
});
