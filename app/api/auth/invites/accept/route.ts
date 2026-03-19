import { NextResponse } from "next/server";
import { acceptInvite } from "@/lib/auth/inviteAccept";
import { setSessionCookie } from "@/lib/auth/session";

function getClientIp(req: Request): string | null {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
        const first = xff.split(",")[0]?.trim();
        return first || null;
    }
    return null;
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);

    const token = typeof body?.token === "string" ? body.token : "";
    const password = typeof body?.password === "string" ? body.password : "";

    const userAgent = req.headers.get("user-agent");
    const ip = getClientIp(req);

    const result = await acceptInvite({
        token,
        password,
        ip,
        userAgent,
    });

    if (!result.ok) {
        const status =
            result.reason === "EMAIL_ALREADY_MEMBER"
                ? 409
                : result.reason === "INVALID_INPUT"
                    ? 400
                    : result.reason === "INVALID_INVITE"
                        ? 400
                        : result.reason === "EXPIRED_INVITE"
                            ? 400
                            : 400;

        return NextResponse.json(
            { ok: false, reason: result.reason },
            { status }
        );
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });
    setSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
    return res;
}