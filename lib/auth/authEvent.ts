import crypto from "crypto";
import { prisma } from "@/lib/db";
import { AuthEventType, Prisma } from "@prisma/client";

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function logAuthEvent(params: {
  type: AuthEventType;
  userId?: string | null;
  companyId?: string | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: unknown;
}): Promise<void> {
  const ipHash = params.ip ? sha256Hex(params.ip) : null;
  const userAgentHash = params.userAgent ? sha256Hex(params.userAgent) : null;

  await prisma.authEvent.create({
    data: {
      type: params.type,
      userId: params.userId ?? null,
      companyId: params.companyId ?? null,
      email: params.email ?? null,
      ipHash,
      userAgentHash,
      meta: params.meta ?? Prisma.JsonNull,
    },
  });
}
