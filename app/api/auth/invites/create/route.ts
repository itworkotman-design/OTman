import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { createInvite } from "@/lib/auth/inviteCreate";

function getClientIp(req: Request): string | null {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
        const first = xff.split(",")[0]?.trim();
        return first || null;
    }
    return null;
}

export async function POST(req: Request) {
    const session = await getAuthenticatedSession(req);

    if (!session) {
        return NextResponse.json(
            { ok: false, reason: "UNAUTHORIZED" },
            { status: 401 }
        );
    }

    if (!session.activeCompanyId) {
        return NextResponse.json(
            { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
            { status: 409 }
        );
    }

    const body = await req.json().catch(() => null);

    const email = typeof body?.email === "string" ? body.email : "";
    const role = typeof body?.role === "string" ? body.role : "";

    const userAgent = req.headers.get("user-agent");
    const ip = getClientIp(req);

    const result = await createInvite({
        actorUserId: session.userId,
        companyId: session.activeCompanyId,
        email,
        role,
        ip,
        userAgent,
    });

    if (!result.ok) {
        const status =
            result.reason === "FORBIDDEN"
                ? 403
                : result.reason === "INVALID_INPUT"
                    ? 400
                    : 400;

        return NextResponse.json(
            { ok: false, reason: result.reason },
            { status }
        );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
}
