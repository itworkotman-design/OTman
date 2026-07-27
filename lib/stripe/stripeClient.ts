import Stripe from "stripe";

let cachedClient: Stripe | null = null;

// Lazy singleton — constructed on first use rather than at module load, so
// importing this file never throws in environments without Stripe configured
// (e.g. running unrelated tests).
export function getStripeClient(): Stripe {
  if (cachedClient) {
    return cachedClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  cachedClient = new Stripe(secretKey);
  return cachedClient;
}

export function getOrderActionBaseUrl(): string {
  const baseUrl = process.env.ORDER_ACTION_BASE_URL;
  if (!baseUrl) {
    throw new Error("ORDER_ACTION_BASE_URL is not configured");
  }

  return baseUrl.replace(/\/+$/, "");
}
