import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  accountFindUnique: vi.fn(),
  accountCreate: vi.fn(),
  accountUpdate: vi.fn(),
  orderUpdate: vi.fn(),
  sessionUpdateMany: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    customerAccount: { findUnique: mocks.accountFindUnique, create: mocks.accountCreate, update: mocks.accountUpdate },
    order: { update: mocks.orderUpdate },
    customerSession: { updateMany: mocks.sessionUpdateMany },
  },
}));

vi.mock("@/lib/auth/password", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("./generatedPassword", () => ({ generateCustomerPassword: () => "Abcdefgh2345" }));

import { ensureCustomerAccountForOrder } from "./ensureCustomerAccount";

const NOW = new Date("2026-10-05T12:00:00Z");

function liveAccount(orders: object[] = [{ id: "other", status: "processing", statusChangedAt: NOW, updatedAt: NOW, gdprHold: false }]) {
  return { id: "acc-1", orders };
}

describe("ensureCustomerAccountForOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hashPassword.mockResolvedValue("hashed");
    mocks.accountCreate.mockResolvedValue({ id: "acc-new" });
  });

  it("does nothing without a usable email", async () => {
    expect(await ensureCustomerAccountForOrder({ orderId: "o1", email: "  " })).toBeNull();
    expect(await ensureCustomerAccountForOrder({ orderId: "o1", email: null })).toBeNull();
    expect(mocks.accountCreate).not.toHaveBeenCalled();
  });

  it("creates an account with a generated password for a new customer, linked to the order", async () => {
    mocks.accountFindUnique.mockResolvedValue(null);

    const result = await ensureCustomerAccountForOrder({ orderId: "o1", email: " Kari@Example.com ", now: NOW });

    expect(result).toEqual({ accountId: "acc-new", email: "kari@example.com", newPassword: "Abcdefgh2345" });
    expect(mocks.hashPassword).toHaveBeenCalledWith("Abcdefgh2345");
    expect(mocks.accountCreate).toHaveBeenCalledWith({
      data: { email: "kari@example.com", passwordHash: "hashed" },
      select: { id: true },
    });
    expect(mocks.orderUpdate).toHaveBeenCalledWith({ where: { id: "o1" }, data: { customerAccountId: "acc-new" } });
  });

  it("links a returning customer's order to their live account without changing the password", async () => {
    mocks.accountFindUnique.mockResolvedValue(liveAccount());

    const result = await ensureCustomerAccountForOrder({ orderId: "o2", email: "kari@example.com", now: NOW });

    expect(result).toEqual({ accountId: "acc-1", email: "kari@example.com", newPassword: null });
    expect(mocks.accountUpdate).not.toHaveBeenCalled();
    expect(mocks.orderUpdate).toHaveBeenCalledWith({ where: { id: "o2" }, data: { customerAccountId: "acc-1" } });
  });

  it("gives an expired account (cron not run yet) a new password and signs out its sessions", async () => {
    const old = new Date("2026-09-01T00:00:00Z");
    mocks.accountFindUnique.mockResolvedValue(
      liveAccount([{ id: "other", status: "completed", statusChangedAt: old, updatedAt: old, gdprHold: false }]),
    );

    const result = await ensureCustomerAccountForOrder({ orderId: "o2", email: "kari@example.com", now: NOW });

    expect(result?.newPassword).toBe("Abcdefgh2345");
    expect(mocks.accountUpdate).toHaveBeenCalledWith({ where: { id: "acc-1" }, data: { passwordHash: "hashed" } });
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: { customerAccountId: "acc-1", revokedAt: null },
      data: { revokedAt: NOW },
    });
  });

  it("ignores the order being linked when deciding whether the account expired", async () => {
    // The account's only order is this one: nothing else keeps it alive, so
    // the customer needs a fresh password.
    mocks.accountFindUnique.mockResolvedValue(
      liveAccount([{ id: "o1", status: "processing", statusChangedAt: NOW, updatedAt: NOW, gdprHold: false }]),
    );

    const result = await ensureCustomerAccountForOrder({ orderId: "o1", email: "kari@example.com", now: NOW });

    expect(result?.newPassword).toBe("Abcdefgh2345");
  });

  it("always resets the password when staff send a new login", async () => {
    mocks.accountFindUnique.mockResolvedValue(liveAccount());

    const result = await ensureCustomerAccountForOrder({ orderId: "o2", email: "kari@example.com", forceNewPassword: true, now: NOW });

    expect(result?.newPassword).toBe("Abcdefgh2345");
    expect(mocks.accountUpdate).toHaveBeenCalled();
  });

  it("falls back to the existing account when another request created it first", async () => {
    mocks.accountFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(liveAccount());
    mocks.accountCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" }),
    );

    const result = await ensureCustomerAccountForOrder({ orderId: "o2", email: "kari@example.com", now: NOW });

    expect(result).toEqual({ accountId: "acc-1", email: "kari@example.com", newPassword: null });
  });
});
