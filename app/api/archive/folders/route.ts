import { NextResponse } from "next/server";
import type { ArchiveHostAdapterErrorCategory } from "@customprojects/custom-archive";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { canAccessArchive } from "@/lib/users/access";
import { archive } from "@/lib/docArchive/client";
import {
  buildArchiveContext,
  ensureNamespaceBootstrapped,
} from "@/lib/docArchive/context";

function errorStatus(category: ArchiveHostAdapterErrorCategory): number {
  switch (category) {
    case "unauthorized":
      return 401;
    case "not_found":
      return 404;
    case "validation":
      return 400;
    default:
      return 500;
  }
}

async function requireArchiveMembership(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return {
      error: NextResponse.json(
        { ok: false, reason: "UNAUTHORIZED" },
        { status: 401 },
      ),
    } as const;
  }

  if (!session.activeCompanyId) {
    return {
      error: NextResponse.json(
        { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
        { status: 409 },
      ),
    } as const;
  }

  const membership = await getActiveMembership({
    userId: session.userId,
    companyId: session.activeCompanyId,
  });

  if (!membership || !canAccessArchive(membership.role, membership.permissions)) {
    return {
      error: NextResponse.json(
        { ok: false, reason: "FORBIDDEN" },
        { status: 403 },
      ),
    } as const;
  }

  return { session, membership } as const;
}

export async function GET(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const ctx = buildArchiveContext(result.session, result.membership);
  const listResult = await archive.listRootFolders(ctx);

  if (!listResult.ok) {
    return NextResponse.json(
      { ok: false, reason: listResult.error.category, message: listResult.error.message },
      { status: errorStatus(listResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, folders: listResult.value });
}

export async function POST(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { session, membership } = result;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const description =
    typeof body?.description === "string" ? body.description.trim() || null : null;

  const ctx = buildArchiveContext(session, membership);

  await ensureNamespaceBootstrapped(ctx, membership.role);

  const createResult = await archive.createFolder(ctx, { name, description });

  if (!createResult.ok) {
    return NextResponse.json(
      { ok: false, reason: createResult.error.category, message: createResult.error.message },
      { status: errorStatus(createResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, folder: createResult.value }, { status: 201 });
}
