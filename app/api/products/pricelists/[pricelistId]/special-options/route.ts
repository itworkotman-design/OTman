import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

function normalizeType(value: unknown): "RETURN" | "XTRA" | null {
  if (typeof value !== "string") return null;

  const v = value.trim().toLowerCase();

  if (v === "return") return "RETURN";
  if (v === "xtra") return "XTRA";

  return null;
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function buildUniqueSpecialOptionCode(params: {
  priceListId: string;
  type: "RETURN" | "XTRA";
  preferredCode: string;
}) {
  const { priceListId, type, preferredCode } = params;

  const existing = await prisma.priceListSpecialOption.findMany({
    where: {
      priceListId,
      type,
      code: {
        startsWith: preferredCode,
      },
    },
    select: {
      code: true,
    },
  });

  const existingCodes = new Set(existing.map((item) => item.code));

  if (!existingCodes.has(preferredCode)) {
    return preferredCode;
  }

  let counter = 2;
  while (existingCodes.has(`${preferredCode}${counter}`)) {
    counter += 1;
  }

  return `${preferredCode}${counter}`;
}

function toDateInputValue(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ pricelistId: string }> },
) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { pricelistId } = await params;

  const body = await req.json().catch(() => null);

  const type = normalizeType(body?.type);
  if (!type) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_TYPE" },
      { status: 400 },
    );
  }

  const preferredCode =
    parseOptionalString(body?.code)?.toUpperCase() ??
    (type === "RETURN" ? "RETURN" : "XTRA");

  const code = await buildUniqueSpecialOptionCode({
    priceListId: pricelistId,
    type,
    preferredCode,
  });

  const label =
    parseOptionalString(body?.label) ?? (type === "RETURN" ? "Return" : "XTRA");

  const description =
    parseOptionalString(body?.description) ??
    (type === "RETURN" ? "Return option" : "Extra amount option");

  const priceList = await prisma.priceList.findUnique({
    where: { id: pricelistId },
    select: { id: true },
  });

  if (!priceList) {
    return NextResponse.json(
      { ok: false, reason: "PRICE_LIST_NOT_FOUND" },
      { status: 404 },
    );
  }

  const maxSort = await prisma.priceListSpecialOption.aggregate({
    where: {
      priceListId: pricelistId,
      type,
    },
    _max: {
      sortOrder: true,
    },
  });

  const created = await prisma.priceListSpecialOption.create({
    data: {
      priceListId: pricelistId,
      type,
      code,
      label,
      description,
      customerPrice: 0,
      subcontractorPrice: 0,
      discountAmount: null,
      discountEndsAt: null,
      isActive: true,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      item: {
        id: created.id,
        type: created.type.toLowerCase(),
        category: created.type.toLowerCase(),
        code: created.code,
        optionCode: created.code,
        label: created.label,
        optionLabel: created.label,
        description: created.description,
        sortOrder: created.sortOrder,
        customerPrice: String(created.customerPrice),
        subcontractorPrice: String(created.subcontractorPrice),
        discountAmount: created.discountAmount ?? "",
        discountEndsAt: toDateInputValue(created.discountEndsAt),
        effectiveCustomerPrice: String(created.customerPrice),
        isActive: created.isActive,
      },
    },
    { status: 201 },
  );
}
