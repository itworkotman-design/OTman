import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { createUserWithPassword } from "@/lib/auth/userCreate";
import {
  normalizeUserLogoPath,
  normalizeUsernameDisplayColor,
} from "@/lib/users/profileAppearance";

type AppPermission = "BOOKING_VIEW" | "BOOKING_CREATE";

function parsePermissions(value: unknown): AppPermission[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (permission: unknown): permission is AppPermission =>
      permission === "BOOKING_VIEW" || permission === "BOOKING_CREATE",
  );
}

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => null);

  const email = typeof body?.email === "string" ? body.email : "";
  const role = typeof body?.role === "string" ? body.role : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body?.confirmPassword === "string" ? body.confirmPassword : "";
  const username = typeof body?.username === "string" ? body.username : "";
  const warehouseEmail =
    typeof body?.warehouseEmail === "string" ? body.warehouseEmail : "";
  const phoneNumber =
    typeof body?.phoneNumber === "string" ? body.phoneNumber : "";
  const address = typeof body?.address === "string" ? body.address : "";
  const description =
    typeof body?.description === "string" ? body.description : "";
  const logoPath = normalizeUserLogoPath(
    typeof body?.logoPath === "string" ? body.logoPath : null,
  );
  const usernameDisplayColor = normalizeUsernameDisplayColor(
    typeof body?.usernameDisplayColor === "string"
      ? body.usernameDisplayColor
      : null,
  );
  const priceListId =
    typeof body?.priceListId === "string" ? body.priceListId : null;
  const permissions = parsePermissions(body?.permissions);

  if (password !== confirmPassword) {
    return NextResponse.json(
      { ok: false, reason: "PASSWORD_MISMATCH" },
      { status: 400 },
    );
  }

  const result = await createUserWithPassword({
    actorUserId: session.userId,
    companyId: session.activeCompanyId,
    email,
    role,
    password,
    username,
    warehouseEmail,
    phoneNumber,
    address,
    description,
    logoPath,
    usernameDisplayColor,
    priceListId,
    permissions,
  });

  if (!result.ok) {
    const status =
      result.reason === "FORBIDDEN"
        ? 403
        : result.reason === "EMAIL_ALREADY_EXISTS" ||
            result.reason === "EMAIL_ALREADY_MEMBER"
          ? 409
          : 400;

    return NextResponse.json({ ok: false, reason: result.reason }, { status });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
