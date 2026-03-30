import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { OPTION_CATEGORIES } from "@/lib/booking/constants";
import { getEffectivePrice } from "@/lib/products/discounts";

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDateInputValue(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const existing = await prisma.priceListSpecialOption.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const customerPrice = parseNumber(body.customerPrice);
  const subcontractorPrice = parseNumber(body.subcontractorPrice);

  if (customerPrice === null || customerPrice < 0) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_CUSTOMER_PRICE" },
      { status: 400 },
    );
  }

  if (subcontractorPrice === null || subcontractorPrice < 0) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_SUBCONTRACTOR_PRICE" },
      { status: 400 },
    );
  }

  const discountAmount = parseOptionalString(body.discountAmount);

  const updated = await prisma.priceListSpecialOption.update({
    where: { id },
    data: {
      code:
        parseOptionalString(body.optionCode ?? body.code)?.toUpperCase() ??
        existing.code,
      description:
        parseOptionalString(body.description) ?? existing.description,
      customerPrice,
      subcontractorPrice,
      discountAmount,
      discountEndsAt: body.discountEndsAt
        ? new Date(body.discountEndsAt)
        : null,
      isActive:
        typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
    },
  });

const discountAmountNumber =
  updated.discountAmount === null ? null : Number(updated.discountAmount);

const effectiveCustomerPrice = getEffectivePrice({
  basePrice: Number(updated.customerPrice),
  discountAmount:
    discountAmountNumber !== null && Number.isFinite(discountAmountNumber)
      ? discountAmountNumber
      : null,
  discountEndsAt: updated.discountEndsAt,
});

  return NextResponse.json({
    ok: true,
    item: {
      id: updated.id,
      type: updated.type.toLowerCase(),
      category:
        updated.type.toLowerCase() === "return"
          ? OPTION_CATEGORIES.RETURN
          : updated.type.toLowerCase(),
      code: updated.code,
      optionCode: updated.code,
      label: updated.label,
      optionLabel: updated.label,
      description: updated.description,
      sortOrder: updated.sortOrder,
      customerPrice: String(updated.customerPrice),
      subcontractorPrice: String(updated.subcontractorPrice),
      discountAmount: updated.discountAmount ?? "",
      discountEndsAt: toDateInputValue(updated.discountEndsAt),
      effectiveCustomerPrice: String(effectiveCustomerPrice),
      isActive: updated.isActive,
    },
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { id } = await params;

  const existing = await prisma.priceListSpecialOption.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  await prisma.priceListSpecialOption.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
}
