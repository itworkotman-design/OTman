import { describe, expect, it, vi } from "vitest";
import {
  PUBLIC_ORDER_NUMBER_ALPHABET,
  PUBLIC_ORDER_NUMBER_LENGTH,
  generatePublicOrderNumber,
  reservePublicOrderNumber,
} from "./publicOrderNumber";

describe("generatePublicOrderNumber", () => {
  it("is 8 characters drawn only from the unambiguous, vowel-free alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const value = generatePublicOrderNumber();
      expect(value).toHaveLength(PUBLIC_ORDER_NUMBER_LENGTH);
      expect(value).toMatch(new RegExp(`^[${PUBLIC_ORDER_NUMBER_ALPHABET}]{8}$`));
    }
  });

  it("never uses look-alike characters (0/O, 1/I/L) or vowels (no accidental words)", () => {
    expect(PUBLIC_ORDER_NUMBER_ALPHABET).not.toMatch(/[01OILAEUY]/);
  });

  it("is not sequential — many draws are (practically) all distinct", () => {
    const values = new Set(Array.from({ length: 2000 }, () => generatePublicOrderNumber()));
    expect(values.size).toBe(2000);
  });
});

describe("reservePublicOrderNumber", () => {
  it("returns a number no other order in the company already uses", async () => {
    const client = { order: { findFirst: vi.fn().mockResolvedValue(null) } };

    const value = await reservePublicOrderNumber(client as never, "company1");

    expect(value).toHaveLength(8);
    expect(client.order.findFirst).toHaveBeenCalledWith({
      where: { companyId: "company1", orderNumber: value },
      select: { id: true },
    });
  });

  it("retries with a fresh number when the first one is already taken", async () => {
    const client = {
      order: { findFirst: vi.fn().mockResolvedValueOnce({ id: "taken" }).mockResolvedValueOnce(null) },
    };

    await reservePublicOrderNumber(client as never, "company1");

    expect(client.order.findFirst).toHaveBeenCalledTimes(2);
    const [first, second] = client.order.findFirst.mock.calls.map(([args]) => args.where.orderNumber);
    expect(first).not.toBe(second);
  });

  it("gives up with an error instead of looping forever if every candidate is taken", async () => {
    const client = { order: { findFirst: vi.fn().mockResolvedValue({ id: "taken" }) } };

    await expect(reservePublicOrderNumber(client as never, "company1")).rejects.toThrow();
    expect(client.order.findFirst.mock.calls.length).toBeLessThanOrEqual(10);
  });
});
