import { randomUUID } from "crypto";

// Powers the public, unauthenticated pay/cancel/request-change links emailed
// to a website-order customer. Generated once (on first Approved/Rejected
// transition) and kept stable for the order's lifetime.
export function createOrderActionToken(): string {
  return randomUUID().replaceAll("-", "");
}
