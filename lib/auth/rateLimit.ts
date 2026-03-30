import { prisma } from "@/lib/db";

export const LOGIN_EMAIL_LIMIT = 50;
export const LOGIN_IP_LIMIT = 20;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_EMAIL_LIMIT = 3;
export const PASSWORD_RESET_IP_LIMIT = 10;
export const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export type RateLimitCheckResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

function getWindowResetAt(windowMs: number): Date {
  return new Date(Date.now() + windowMs);
}

export async function checkRateLimit(params: {
  key: string;
  limit: number;
}): Promise<RateLimitCheckResult> {
  const bucket = await prisma.rateLimitBucket.findUnique({
    where: { key: params.key },
    select: { count: true, resetAt: true },
  });

  if (!bucket) {
    return { allowed: true };
  }

  const now = Date.now();
  const resetAtMs = bucket.resetAt.getTime();

  if (resetAtMs <= now) {
    return { allowed: true };
  }

  if (bucket.count >= params.limit) {
    return {
      allowed: false,
      retryAfterMs: Math.max(0, resetAtMs - now),
    };
  }

  return { allowed: true };
}

export async function incrementRateLimit(params: {
  key: string;
  windowMs: number;
}): Promise<void> {
  const existing = await prisma.rateLimitBucket.findUnique({
    where: { key: params.key },
    select: { key: true, count: true, resetAt: true },
  });

  const now = Date.now();

  if (!existing || existing.resetAt.getTime() <= now) {
    await prisma.rateLimitBucket.upsert({
      where: { key: params.key },
      create: {
        key: params.key,
        count: 1,
        resetAt: getWindowResetAt(params.windowMs),
      },
      update: {
        count: 1,
        resetAt: getWindowResetAt(params.windowMs),
      },
    });

    return;
  }

  await prisma.rateLimitBucket.update({
    where: { key: params.key },
    data: {
      count: { increment: 1 },
    },
  });
}

export async function clearRateLimit(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({
    where: { key },
  });
}
