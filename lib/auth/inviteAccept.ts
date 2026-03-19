import { AuthEventType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashInviteToken } from "@/lib/auth/inviteToken";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/createSession";
import { logAuthEvent } from "@/lib/auth/authEvent";

type AcceptInviteResult =
    | {
        ok: true;
        userId: string;
        companyId: string;
        sessionToken: string;
        sessionExpiresAt: Date;
    }
    | {
        ok: false;
        reason:
        | "INVALID_INPUT"
        | "INVALID_INVITE"
        | "EXPIRED_INVITE"
        | "EMAIL_ALREADY_MEMBER";
    };

export async function acceptInvite(params: {
    token: string;
    password: string;
    ip?: string | null;
    userAgent?: string | null;
}): Promise<AcceptInviteResult> {
    const token = params.token.trim();
    const password = params.password;

    if (!token || !password.trim()) {
        return { ok: false, reason: "INVALID_INPUT" };
    }

    const tokenHash = hashInviteToken(token);

    const invite = await prisma.invite.findUnique({
        where: {
            tokenHash,
        },
        select: {
            id: true,
            companyId: true,
            email: true,
            role: true,
            status: true,
            expiresAt: true,
        },
    });

    if (!invite || invite.status !== "PENDING") {
        return { ok: false, reason: "INVALID_INVITE" };
    }

    if (invite.expiresAt <= new Date()) {
        return { ok: false, reason: "EXPIRED_INVITE" };
    }

    const email = invite.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
        where: {
            email,
        },
        select: {
            id: true,
        },
    });

    if (existingUser) {
        const existingMembership = await prisma.membership.findUnique({
            where: {
                userId_companyId: {
                    userId: existingUser.id,
                    companyId: invite.companyId,
                },
            },
            select: {
                id: true,
            },
        });

        if (existingMembership) {
            return { ok: false, reason: "EMAIL_ALREADY_MEMBER" };
        }
    }

    let userId = existingUser?.id ?? "";

    await prisma.$transaction(async (tx) => {
        if (!existingUser) {
            const passwordHash = await hashPassword(password);

            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    status: "ACTIVE",
                },
                select: {
                    id: true,
                },
            });

            userId = user.id;
        } else {
            userId = existingUser.id;
        }

        await tx.membership.create({
            data: {
                userId,
                companyId: invite.companyId,
                role: invite.role,
                status: "ACTIVE",
            },
            select: {
                id: true,
            },
        });

        await tx.invite.update({
            where: {
                id: invite.id,
            },
            data: {
                status: "ACCEPTED",
                acceptedAt: new Date(),
            },
            select: {
                id: true,
            },
        });
    });

    const { sessionToken, sessionExpiresAt } = await createSession({
        userId,
        ip: params.ip,
        userAgent: params.userAgent,
    });

    await logAuthEvent({
        type: AuthEventType.INVITE_ACCEPTED,
        userId,
        companyId: invite.companyId,
        email,
        ip: params.ip,
        userAgent: params.userAgent,
        meta: {
            inviteId: invite.id,
            role: invite.role,
        },
    });

    return {
        ok: true,
        userId,
        companyId: invite.companyId,
        sessionToken,
        sessionExpiresAt,
    };
}
