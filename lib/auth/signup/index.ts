import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/createSession";

type SignupResult =
  | {
      ok: true;
      userId: string;
      companyId: string;
      sessionToken: string;
      sessionExpiresAt: Date;
    }
  | { ok: false; reason: "INVALID_INPUT" | "EMAIL_ALREADY_EXISTS" };

export async function signupWithEmailPassword(params: {
  email: string;
  password: string;
  companyName: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<SignupResult> {
  const email = params.email.trim().toLowerCase();
  const password = params.password;
  const companyName = params.companyName.trim();

  if (!email || !password || !companyName) {
    return { ok: false, reason: "INVALID_INPUT" };
  }

  if (password.length < 8) {
    return { ok: false, reason: "INVALID_INPUT" };
  }

  const passwordHash = await hashPassword(password);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        return { ok: false as const, reason: "EMAIL_ALREADY_EXISTS" as const };
      }

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      const company = await tx.company.create({
        data: {
          name: companyName,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          companyId: company.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });

      return {
        ok: true as const,
        userId: user.id,
        companyId: company.id,
      };
    });

    if (!result.ok) {
      return result;
    }

    const session = await createSession({
      userId: result.userId,
      ip: params.ip,
      userAgent: params.userAgent,
    });

    return {
      ok: true,
      userId: result.userId,
      companyId: result.companyId,
      sessionToken: session.sessionToken,
      sessionExpiresAt: session.sessionExpiresAt,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "EMAIL_ALREADY_EXISTS" };
    }

    throw error;
  }
}