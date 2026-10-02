import { describe, expect, it, vi } from "vitest";
import { ensureWebsiteAccount, type WebsiteAccountDb } from "./websiteAccount";

type FakeState = {
  company?: { id: string } | null;
  user?: { id: string } | null;
  membership?: { id: string; status: string } | null;
};

function fakeDb(state: FakeState) {
  return {
    company: { findUnique: vi.fn().mockResolvedValue(state.company ?? null) },
    user: {
      findUnique: vi.fn().mockResolvedValue(state.user ?? null),
      create: vi.fn().mockResolvedValue({ id: "new-user" }),
    },
    membership: {
      findUnique: vi.fn().mockResolvedValue(state.membership ?? null),
      create: vi.fn().mockResolvedValue({ id: "new-membership", status: "ACTIVE" }),
      update: vi.fn().mockResolvedValue({ id: state.membership?.id ?? "", status: "ACTIVE" }),
    },
  } satisfies WebsiteAccountDb;
}

const options = { email: "website@otman.no", companySlug: "otman", passwordHash: "hash" };

describe("ensureWebsiteAccount", () => {
  it("fails when the company doesn't exist", async () => {
    const db = fakeDb({ company: null });
    await expect(ensureWebsiteAccount(db, options)).rejects.toThrow(/otman/);
  });

  it("creates the user and an active USER membership when neither exists", async () => {
    const db = fakeDb({ company: { id: "c1" } });

    const result = await ensureWebsiteAccount(db, options);

    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "website@otman.no", passwordHash: "hash" }) }),
    );
    expect(db.membership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: "new-user", companyId: "c1", role: "USER", status: "ACTIVE" },
      }),
    );
    expect(result).toEqual({ membershipId: "new-membership", createdUser: true, createdMembership: true });
  });

  it("reuses an existing user and membership without touching the password", async () => {
    const db = fakeDb({
      company: { id: "c1" },
      user: { id: "u1" },
      membership: { id: "m1", status: "ACTIVE" },
    });

    const result = await ensureWebsiteAccount(db, options);

    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.membership.create).not.toHaveBeenCalled();
    expect(db.membership.update).not.toHaveBeenCalled();
    expect(result).toEqual({ membershipId: "m1", createdUser: false, createdMembership: false });
  });

  it("reactivates an inactive existing membership", async () => {
    const db = fakeDb({
      company: { id: "c1" },
      user: { id: "u1" },
      membership: { id: "m1", status: "DISABLED" },
    });

    await ensureWebsiteAccount(db, options);

    expect(db.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1" }, data: { status: "ACTIVE" } }),
    );
  });
});
