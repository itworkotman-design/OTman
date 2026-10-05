import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), deleteMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { customerAccount: { findMany: mocks.findMany, deleteMany: mocks.deleteMany } },
}));

import { runCustomerAccountCleanup } from "./runCustomerAccountCleanup";

const NOW = new Date("2026-10-05T12:00:00Z");
const old = new Date("2026-10-01T00:00:00Z");
const recent = new Date("2026-10-05T06:00:00Z");

function o(status: string, changedAt: Date, gdprHold = false) {
  return { id: `o-${status}`, status, statusChangedAt: changedAt, updatedAt: changedAt, gdprHold, createdAt: changedAt };
}

describe("runCustomerAccountCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteMany.mockResolvedValue({ count: 0 });
  });

  it("deletes only accounts whose orders are all closed for over a day and not on hold", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "done", orders: [o("completed", old)] },
      { id: "no-show-reopened", orders: [o("processing", old)] },
      { id: "just-closed", orders: [o("cancelled", recent)] },
      { id: "insurance", orders: [o("completed", old, true)] },
      { id: "orphan", orders: [] },
    ]);
    mocks.deleteMany.mockResolvedValue({ count: 2 });

    const summary = await runCustomerAccountCleanup({ now: NOW });

    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["done", "orphan"] } } });
    expect(summary).toEqual({ checked: 5, deleted: 2 });
  });

  it("does not touch the database when nothing is due", async () => {
    mocks.findMany.mockResolvedValue([{ id: "a", orders: [o("processing", old)] }]);
    expect(await runCustomerAccountCleanup({ now: NOW })).toEqual({ checked: 1, deleted: 0 });
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
});
