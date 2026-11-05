import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  numberFindUnique: vi.fn(),
  numberAggregate: vi.fn(),
  numberCreate: vi.fn(),
  paymentUpdateMany: vi.fn(),
  refundUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    receiptNumber: { findUnique: mocks.numberFindUnique, aggregate: mocks.numberAggregate, create: mocks.numberCreate },
    orderPayment: { updateMany: mocks.paymentUpdateMany },
    orderRefund: { updateMany: mocks.refundUpdateMany },
  },
}));

import { allocateReceiptNumber, formatReceiptNumber } from "./receiptNumbers";

const uniqueViolation = () => Object.assign(new Error("Unique constraint"), { code: "P2002" });

describe("formatReceiptNumber — the web-sales series", () => {
  it("prefixes the number with W-", () => {
    expect(formatReceiptNumber(3)).toBe("W-3");
    expect(formatReceiptNumber(120)).toBe("W-120");
  });
});

describe("allocateReceiptNumber — one unbroken series for receipts and credit notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.numberFindUnique.mockResolvedValue(null);
    mocks.numberAggregate.mockResolvedValue({ _max: { number: 6 } });
    mocks.numberCreate.mockResolvedValue({});
    mocks.paymentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.refundUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("gives a payment the next number and writes it on the payment", async () => {
    expect(await allocateReceiptNumber({ orderPaymentId: "pay1" })).toBe(7);
    expect(mocks.numberCreate).toHaveBeenCalledWith({ data: { number: 7, orderPaymentId: "pay1" } });
    expect(mocks.paymentUpdateMany).toHaveBeenCalledWith({ where: { id: "pay1" }, data: { receiptNumber: 7 } });
  });

  it("gives a refund the next number from the same series", async () => {
    expect(await allocateReceiptNumber({ orderRefundId: "ref1" })).toBe(7);
    expect(mocks.numberCreate).toHaveBeenCalledWith({ data: { number: 7, orderRefundId: "ref1" } });
    expect(mocks.refundUpdateMany).toHaveBeenCalledWith({ where: { id: "ref1" }, data: { receiptNumber: 7 } });
  });

  it("starts the series at 1", async () => {
    mocks.numberAggregate.mockResolvedValue({ _max: { number: null } });
    expect(await allocateReceiptNumber({ orderPaymentId: "pay1" })).toBe(1);
  });

  it("keeps a number the document already has (no gaps, no second number)", async () => {
    mocks.numberFindUnique.mockResolvedValue({ number: 4 });
    expect(await allocateReceiptNumber({ orderPaymentId: "pay1" })).toBe(4);
    expect(mocks.numberCreate).not.toHaveBeenCalled();
    // Re-written in case a crash left the payment without it.
    expect(mocks.paymentUpdateMany).toHaveBeenCalledWith({ where: { id: "pay1" }, data: { receiptNumber: 4 } });
  });

  it("takes the number after when another document took it at the same time", async () => {
    mocks.numberAggregate.mockResolvedValueOnce({ _max: { number: 6 } }).mockResolvedValueOnce({ _max: { number: 7 } });
    mocks.numberCreate.mockRejectedValueOnce(uniqueViolation());
    expect(await allocateReceiptNumber({ orderPaymentId: "pay1" })).toBe(8);
  });

  it("returns the number a parallel call already gave this same document", async () => {
    mocks.numberCreate.mockRejectedValueOnce(uniqueViolation());
    mocks.numberFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ number: 7 });
    expect(await allocateReceiptNumber({ orderPaymentId: "pay1" })).toBe(7);
    expect(mocks.numberCreate).toHaveBeenCalledTimes(1);
  });

  it("rethrows anything other than a unique violation", async () => {
    mocks.numberCreate.mockRejectedValueOnce(new Error("db down"));
    await expect(allocateReceiptNumber({ orderPaymentId: "pay1" })).rejects.toThrow("db down");
  });
});
