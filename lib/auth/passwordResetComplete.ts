import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { logAuthEvent } from "@/lib/auth/authEvent";
import { revokeAllUserSessions } from "@/lib/auth/session";
import { hashPasswordResetToken } from "@/lib/auth/passwordResetToken";
import { AuthEventType } from "@prisma/client";

type CompletePasswordResetResult =
  | { ok: true }
  | { ok: false; reason: "INVALID_INPUT" | "INVALID_TOKEN" | "EXPIRED_TOKEN" };

export async function completePasswordReset(params: {
  token: string;
  newPassword: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<CompletePasswordResetResult> {
  const token = params.token.trim();
  const newPassword = params.newPassword;

  if (!token || !newPassword || newPassword.length < 8) {
    return { ok: false, reason: "INVALID_INPUT" };
  }

  const tokenHash = hashPasswordResetToken(token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!resetToken || resetToken.usedAt) {
    return { ok: false, reason: "INVALID_TOKEN" };
  }

  if (resetToken.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "EXPIRED_TOKEN" };
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });
  });

  await revokeAllUserSessions(resetToken.userId);

  await logAuthEvent({
    type: AuthEventType.PASSWORD_RESET_SUCCESS,
    userId: resetToken.userId,
    ip: params.ip,
    userAgent: params.userAgent,
  });

  return { ok: true };
}
