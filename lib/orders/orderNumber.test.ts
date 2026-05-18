import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  companyOrderCounterFindUniqueMock: vi.fn(),
  companyOrderCounterCreateMock: vi.fn(),
  companyOrderCounterUpdateMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transactionMock,
  },
}));

import { reserveNextManualOrderNumber } from "./orderNumber";

describe("reserveNextManualOrderNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionMock.mockImplementation((callback) =>
      callback({
        companyOrderCounter: {
          findUnique: mocks.companyOrderCounterFindUniqueMock,
          create: mocks.companyOrderCounterCreateMock,
          update: mocks.companyOrderCounterUpdateMock,
        },
        order: {
          findFirst: mocks.orderFindFirstMock,
        },
      }),
    );
    mocks.companyOrderCounterCreateMock.mockResolvedValue({ companyId: "company-1", nextNumber: 20001 });
    mocks.companyOrderCounterUpdateMock.mockResolvedValue({ companyId: "company-1", nextNumber: 20001 });
  });

  it("starts manual order numbers at 20000", async () => {
    mocks.companyOrderCounterFindUniqueMock.mockResolvedValue(null);
    mocks.orderFindFirstMock.mockResolvedValue(null);

    await expect(reserveNextManualOrderNumber("company-1")).resolves.toBe(20000);

    expect(mocks.orderFindFirstMock).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        OR: [{ displayId: 20000 }, { orderNumber: "20000" }],
      },
      select: {
        id: true,
      },
    });
    expect(mocks.companyOrderCounterCreateMock).toHaveBeenCalledWith({
      data: {
        companyId: "company-1",
        nextNumber: 20001,
      },
    });
  });

  it("skips existing imported WordPress order numbers", async () => {
    mocks.companyOrderCounterFindUniqueMock.mockResolvedValue({
      companyId: "company-1",
      nextNumber: 20000,
    });
    mocks.orderFindFirstMock
      .mockResolvedValueOnce({ id: "imported-wp-order" })
      .mockResolvedValueOnce(null);

    await expect(reserveNextManualOrderNumber("company-1")).resolves.toBe(20001);

    expect(mocks.orderFindFirstMock).toHaveBeenNthCalledWith(1, {
      where: {
        companyId: "company-1",
        OR: [{ displayId: 20000 }, { orderNumber: "20000" }],
      },
      select: {
        id: true,
      },
    });
    expect(mocks.orderFindFirstMock).toHaveBeenNthCalledWith(2, {
      where: {
        companyId: "company-1",
        OR: [{ displayId: 20001 }, { orderNumber: "20001" }],
      },
      select: {
        id: true,
      },
    });
    expect(mocks.companyOrderCounterUpdateMock).toHaveBeenCalledWith({
      where: { companyId: "company-1" },
      data: {
        nextNumber: 20002,
      },
    });
  });
});
