import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { recordOrderPayment, sumOrderPayments } from "./orderPayments";

describe("sumOrderPayments", () => {
  it("sums the charged amounts across every recorded payment", () => {
    expect(
      sumOrderPayments([{ amountChargedCents: 500000 }, { amountChargedCents: 120000 }]),
    ).toBe(620000);
  });

  it("returns 0 for no payments", () => {
    expect(sumOrderPayments([])).toBe(0);
  });
});

function prismaKnownError(code: string) {
  // Prisma's real PrismaClientKnownRequestError constructor needs internal
  // fields vitest doesn't have available in this context — a plain object
  // with the right prototype/shape is enough for the code under test, which
  // only checks `error instanceof Prisma.PrismaClientKnownRequestError` and
  // `.code`.
  const err = Object.create(Prisma.PrismaClientKnownRequestError.prototype);
  err.code = code;
  err.message = "mock";
  return err;
}

describe("recordOrderPayment", () => {
  it("creates a payment row with the given fields", async () => {
    const create = vi.fn().mockResolvedValue({ id: "op1" });
    const client = { orderPayment: { create } };

    const result = await recordOrderPayment(client as never, {
      orderId: "order1",
      companyId: "company1",
      stripeCheckoutSessionId: "cs_123",
      stripePaymentIntentId: "pi_123",
      amountChargedCents: 500000,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        orderId: "order1",
        companyId: "company1",
        stripeCheckoutSessionId: "cs_123",
        stripePaymentIntentId: "pi_123",
        amountChargedCents: 500000,
      },
    });
    expect(result).toEqual({ id: "op1" });
  });

  it("returns null instead of throwing when this session was already recorded (webhook redelivery)", async () => {
    const create = vi.fn().mockRejectedValue(prismaKnownError("P2002"));
    const client = { orderPayment: { create } };

    const result = await recordOrderPayment(client as never, {
      orderId: "order1",
      companyId: "company1",
      stripeCheckoutSessionId: "cs_123",
      stripePaymentIntentId: "pi_123",
      amountChargedCents: 500000,
    });

    expect(result).toBeNull();
  });

  it("re-throws any other error", async () => {
    const create = vi.fn().mockRejectedValue(new Error("connection lost"));
    const client = { orderPayment: { create } };

    await expect(
      recordOrderPayment(client as never, {
        orderId: "order1",
        companyId: "company1",
        stripeCheckoutSessionId: "cs_123",
        stripePaymentIntentId: "pi_123",
        amountChargedCents: 500000,
      }),
    ).rejects.toThrow("connection lost");
  });
});
