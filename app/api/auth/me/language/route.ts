import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";

const USER_LANGUAGES = new Set(["EN", "NO"]);

export async function PATCH(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const body: unknown = await req.json().catch(() => null);
  const language =
    body &&
    typeof body === "object" &&
    "languagePreference" in body &&
    typeof body.languagePreference === "string"
      ? body.languagePreference
      : "";

  if (!USER_LANGUAGES.has(language)) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_LANGUAGE" },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: {
      id: session.userId,
    },
    data: {
      languagePreference: language,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      languagePreference: language,
    },
    { status: 200 },
  );
}
