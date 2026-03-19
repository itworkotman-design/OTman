import crypto from "crypto";
import { prisma } from "@/lib/db";
import { generateSessionToken, hashSessionToken } from "@/lib/auth/sessionToken";
import { SESSION_DAYS } from "@/lib/auth/session";

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function createSession(params: {
  userId: string;
  activeCompanyId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{
  sessionToken: string;
  sessionExpiresAt: Date;
}> {
  const sessionToken = generateSessionToken();
  const tokenHash = hashSessionToken(sessionToken);
  const sessionExpiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.session.create({
    data: {
      userId: params.userId,
      tokenHash,
      expiresAt: sessionExpiresAt,
      activeCompanyId: params.activeCompanyId ?? null,
      ipHash: params.ip ? sha256Hex(params.ip) : null,
      userAgentHash: params.userAgent ? sha256Hex(params.userAgent) : null,
    },
  });

  return { sessionToken, sessionExpiresAt };
}