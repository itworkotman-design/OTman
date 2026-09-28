import { randomInt } from "crypto";
import type { PrismaClient } from "@prisma/client";

// The order number a website customer sees (emails, payment/change/cancel
// pages, confirmation screens) and quotes when they call. Stored in
// Order.orderNumber — the app's existing customer-reference field, so it also
// shows up in the dashboard list/search and on GSM tasks with no extra work.
// The internal, sequential displayId is deliberately NOT shown to customers:
// it leaks order volume and is trivially guessable.
//
// Random, not sequential; 8 chars from a 27-char alphabet (~2.8e11 values).
// Vowels are left out so a random string can't spell a word, and look-alikes
// (0/O, 1/I/L) are left out so it survives being read over the phone.
export const PUBLIC_ORDER_NUMBER_ALPHABET = "BCDFGHJKMNPQRSTVWXZ23456789";
export const PUBLIC_ORDER_NUMBER_LENGTH = 8;

const MAX_ATTEMPTS = 10;

export function generatePublicOrderNumber(): string {
  let value = "";
  for (let i = 0; i < PUBLIC_ORDER_NUMBER_LENGTH; i++) {
    value += PUBLIC_ORDER_NUMBER_ALPHABET[randomInt(PUBLIC_ORDER_NUMBER_ALPHABET.length)];
  }
  return value;
}

// Draws until it finds a number no order in this company already uses. There
// is no DB unique constraint on Order.orderNumber (it also holds free-text
// references from imported/manual orders), so uniqueness is checked here; at
// ~2.8e11 possible values a retry is vanishingly rare.
export async function reservePublicOrderNumber(client: Pick<PrismaClient, "order">, companyId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generatePublicOrderNumber();
    const existing = await client.order.findFirst({
      where: { companyId, orderNumber: candidate },
      select: { id: true },
    });

    if (!existing) return candidate;
  }

  throw new Error("Could not allocate a unique public order number");
}
