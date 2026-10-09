import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  accountFindMany: vi.fn(),
  accountFindUnique: vi.fn(),
  accountFindFirst: vi.fn(),
  accountUpdate: vi.fn(),
  accountDelete: vi.fn(),
  orderUpdateMany: vi.fn(),
  hashPassword: vi.fn(),
  revokeCustomerSessions: vi.fn(),
  sendCustomerCredentialsEmail: vi.fn(),
  createOrderActionEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    customerAccount: {
      findMany: mocks.accountFindMany,
      findUnique: mocks.accountFindUnique,
      findFirst: mocks.accountFindFirst,
      update: mocks.accountUpdate,
      delete: mocks.accountDelete,
    },
    order: { updateMany: mocks.orderUpdateMany },
  },
}));
vi.mock("@/lib/auth/password", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("./customerSession", () => ({ revokeCustomerSessions: mocks.revokeCustomerSessions }));
vi.mock("./customerCredentialsEmail", () => ({ sendCustomerCredentialsEmail: mocks.sendCustomerCredentialsEmail }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderActionEvent: mocks.createOrderActionEvent }));

import {
  changeCustomerAccountEmail,
  deleteCustomerAccount,
  findManageableCustomerAccount,
  listCompanyCustomerAccounts,
  sendNewCustomerPassword,
  setCustomerAccountPassword,
  signOutCustomerAccount,
} from "./adminCustomerAccounts";

const NOW = new Date("2026-10-09T12:00:00Z");
const order = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  companyId: "c1",
  orderNumber: "K7MQ4XZ2",
  displayId: 42,
  status: "processing",
  deliveryDate: "2026-10-15",
  customerName: "Ola",
  emailThreadToken: null,
  statusChangedAt: null,
  updatedAt: new Date("2026-10-08T12:00:00Z"),
  gdprHold: false,
  createdAt: new Date("2026-10-08T12:00:00Z"),
  ...over,
});
const account = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  email: "ola@example.com",
  createdAt: new Date("2026-10-08T12:00:00Z"),
  lastLoginAt: null,
  sessions: [{ id: "s1" }],
  orders: [order()],
  ...over,
});
const actor = { membershipId: "m1", name: "Admin", email: "admin@otman.no", source: "USER" as const };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hashPassword.mockResolvedValue("hashed");
  mocks.sendCustomerCredentialsEmail.mockResolvedValue(true);
});

describe("listCompanyCustomerAccounts", () => {
  it("lists the live accounts with orders in the company, with only that company's orders", async () => {
    mocks.accountFindMany.mockResolvedValue([
      account({ orders: [order(), order({ id: "o2", companyId: "c2", orderNumber: "OTHER" })] }),
      // All orders closed for days: past its delete time, just not cleaned up yet.
      account({
        id: "a2",
        email: "gone@example.com",
        orders: [order({ id: "o3", status: "completed", statusChangedAt: new Date("2026-10-01T12:00:00Z"), updatedAt: new Date("2026-10-01T12:00:00Z") })],
      }),
    ]);

    const rows = await listCompanyCustomerAccounts("c1", NOW);

    expect(mocks.accountFindMany.mock.calls[0][0].where).toEqual({ orders: { some: { companyId: "c1" } } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "a1",
      email: "ola@example.com",
      activeSessions: 1,
      deleteAt: null,
      sharedWithOtherCompany: true,
      orders: [{ id: "o1", orderNumber: "K7MQ4XZ2", displayId: 42, status: "processing", deliveryDate: "2026-10-15" }],
    });
  });

  it("gives an account whose orders are all closed the time it will be deleted", async () => {
    const closedAt = new Date("2026-10-09T08:00:00Z");
    mocks.accountFindMany.mockResolvedValue([account({ orders: [order({ status: "completed", statusChangedAt: closedAt, updatedAt: closedAt })] })]);

    const [row] = await listCompanyCustomerAccounts("c1", NOW);

    expect(row.deleteAt).toEqual(new Date("2026-10-10T08:00:00Z"));
  });
});

describe("findManageableCustomerAccount", () => {
  it("finds an account with orders in the company", async () => {
    mocks.accountFindUnique.mockResolvedValue(account());

    const result = await findManageableCustomerAccount("c1", "a1");

    expect(result).toMatchObject({ ok: true, account: { id: "a1", email: "ola@example.com" } });
  });

  it("is not found without an order in the company", async () => {
    mocks.accountFindUnique.mockResolvedValue(account({ orders: [order({ companyId: "c2" })] }));
    expect(await findManageableCustomerAccount("c1", "a1")).toEqual({ ok: false, reason: "NOT_FOUND" });

    mocks.accountFindUnique.mockResolvedValue(null);
    expect(await findManageableCustomerAccount("c1", "a1")).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("can't be changed while it also has another company's orders", async () => {
    mocks.accountFindUnique.mockResolvedValue(account({ orders: [order(), order({ id: "o2", companyId: "c2" })] }));

    expect(await findManageableCustomerAccount("c1", "a1")).toEqual({ ok: false, reason: "SHARED_ACCOUNT" });
  });
});

describe("setCustomerAccountPassword", () => {
  it("sets the password, signs the account out everywhere and logs it on the orders", async () => {
    const result = await setCustomerAccountPassword({ account: account(), password: "a-new-pass", actor });

    expect(result).toEqual({ ok: true });
    expect(mocks.hashPassword).toHaveBeenCalledWith("a-new-pass");
    expect(mocks.accountUpdate).toHaveBeenCalledWith({ where: { id: "a1" }, data: { passwordHash: "hashed" } });
    expect(mocks.revokeCustomerSessions).toHaveBeenCalledWith("a1");
    expect(mocks.createOrderActionEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "o1", companyId: "c1", actor, title: expect.stringContaining("password") }),
    );
    // The password itself is never logged.
    expect(JSON.stringify(mocks.createOrderActionEvent.mock.calls)).not.toContain("a-new-pass");
  });

  it("refuses a password under 8 characters", async () => {
    expect(await setCustomerAccountPassword({ account: account(), password: "short", actor })).toEqual({ ok: false, reason: "PASSWORD_TOO_SHORT" });
    expect(mocks.accountUpdate).not.toHaveBeenCalled();
  });
});

describe("sendNewCustomerPassword", () => {
  it("sets a generated password, signs out, and emails it on the newest order", async () => {
    const newest = order({ id: "o2", orderNumber: "NEWEST", createdAt: new Date("2026-10-09T08:00:00Z") });

    const result = await sendNewCustomerPassword({ account: account({ orders: [order(), newest] }), actor });

    expect(result).toEqual({ ok: true });
    expect(mocks.revokeCustomerSessions).toHaveBeenCalledWith("a1");
    const sent = mocks.sendCustomerCredentialsEmail.mock.calls[0][0];
    expect(sent.email).toBe("ola@example.com");
    expect(sent.order).toMatchObject({ id: "o2", orderNumber: "NEWEST" });
    expect(sent.password).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(mocks.hashPassword).toHaveBeenCalledWith(sent.password);
  });

  it("reports a failed email", async () => {
    mocks.sendCustomerCredentialsEmail.mockResolvedValue(false);

    expect(await sendNewCustomerPassword({ account: account(), actor })).toEqual({ ok: false, reason: "EMAIL_FAILED" });
  });
});

describe("changeCustomerAccountEmail", () => {
  it("changes the login email and the email on the account's orders in this company", async () => {
    mocks.accountFindUnique.mockResolvedValue(null);

    const result = await changeCustomerAccountEmail({ account: account(), companyId: "c1", email: "  Kari@Example.com ", actor });

    expect(result).toEqual({ ok: true, email: "kari@example.com" });
    expect(mocks.accountUpdate).toHaveBeenCalledWith({ where: { id: "a1" }, data: { email: "kari@example.com" } });
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({ where: { customerAccountId: "a1", companyId: "c1" }, data: { email: "kari@example.com" } });
    expect(mocks.createOrderActionEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ details: expect.arrayContaining(["From: ola@example.com", "To: kari@example.com"]) }),
    );
  });

  it("refuses an invalid email, or one another login already uses", async () => {
    expect(await changeCustomerAccountEmail({ account: account(), companyId: "c1", email: "nope", actor })).toEqual({ ok: false, reason: "INVALID_EMAIL" });

    mocks.accountFindUnique.mockResolvedValue({ id: "a9" });
    expect(await changeCustomerAccountEmail({ account: account(), companyId: "c1", email: "taken@example.com", actor })).toEqual({
      ok: false,
      reason: "EMAIL_TAKEN",
    });
    expect(mocks.accountUpdate).not.toHaveBeenCalled();
  });

  it("treats a unique clash at save time as taken too", async () => {
    mocks.accountFindUnique.mockResolvedValue(null);
    mocks.accountUpdate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }));

    expect(await changeCustomerAccountEmail({ account: account(), companyId: "c1", email: "taken@example.com", actor })).toEqual({
      ok: false,
      reason: "EMAIL_TAKEN",
    });
  });

  it("does nothing when the email is unchanged", async () => {
    expect(await changeCustomerAccountEmail({ account: account(), companyId: "c1", email: "OLA@example.com", actor })).toEqual({
      ok: true,
      email: "ola@example.com",
    });
    expect(mocks.accountUpdate).not.toHaveBeenCalled();
  });
});

describe("signOutCustomerAccount / deleteCustomerAccount", () => {
  it("signs the account out everywhere", async () => {
    await signOutCustomerAccount({ account: account(), actor });

    expect(mocks.revokeCustomerSessions).toHaveBeenCalledWith("a1");
    expect(mocks.createOrderActionEvent).toHaveBeenCalled();
  });

  it("deletes the login (the orders stay), logging it on the orders first", async () => {
    await deleteCustomerAccount({ account: account(), actor });

    expect(mocks.accountDelete).toHaveBeenCalledWith({ where: { id: "a1" } });
    expect(mocks.createOrderActionEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orderId: "o1" }));
  });
});
