import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type Body = {
  customerPrice?: string | number;
  subcontractorPrice?: string | number;
  isActive?: boolean;
};

function parseNokToCents(value: string | number): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value) * 100;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;

  return parsed * 100;
}

function centsToNokString(cents: number) {
  return Math.round(cents / 100).toString();
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { itemId } = await params;
  const body = (await req.json()) as Body;

  const data: {
    customerPriceCents?: number;
    subcontractorPriceCents?: number;
    isActive?: boolean;
  } = {};

  if (body.customerPrice !== undefined) {
    const cents = parseNokToCents(body.customerPrice);

    if (cents === null) {
      return NextResponse.json(
        { ok: false, reason: "INVALID_CUSTOMER_PRICE" },
        { status: 400 },
      );
    }

    data.customerPriceCents = cents;
  }

  if (body.subcontractorPrice !== undefined) {
    const cents = parseNokToCents(body.subcontractorPrice);

    if (cents === null) {
      return NextResponse.json(
        { ok: false, reason: "INVALID_SUBCONTRACTOR_PRICE" },
        { status: 400 },
      );
    }

    data.subcontractorPriceCents = cents;
  }

  if (typeof body.isActive === "boolean") {
    data.isActive = body.isActive;
  }

  const updated = await prisma.priceListItem.update({
    where: { id: itemId },
    data,
    include: {
      productOption: {
        include: {
          product: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      ok: true,
      item: {
        id: updated.id,
        productId: updated.productOption.product.id,
        productOptionId: updated.productOptionId,
        productName: updated.productOption.product.name,
        productCode: updated.productOption.product.code,
        optionCode: updated.productOption.code,
        optionLabel: updated.productOption.label,
        description: updated.productOption.description,
        category: updated.productOption.category,
        sortOrder: updated.productOption.sortOrder,
        customerPrice: centsToNokString(updated.customerPriceCents),
        subcontractorPrice: centsToNokString(updated.subcontractorPriceCents),
        isActive: updated.isActive,
      },
    },
    { status: 200 },
  );
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { itemId } = await params;

  const existing = await prisma.priceListItem.findUnique({
    where: { id: itemId },
    include: {
      productOption: true,
    },
  });

  if (!existing) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const productOptionId = existing.productOptionId;
  const productId = existing.productOption.productId;

  await prisma.$transaction(async (tx) => {
    await tx.priceListItem.delete({
      where: { id: itemId },
    });

    await tx.productOption.delete({
      where: { id: productOptionId },
    });

    const remainingOptions = await tx.productOption.count({
      where: {
        productId,
      },
    });

    if (remainingOptions === 0) {
      await tx.product.delete({
        where: { id: productId },
      });
    }
  });

  return NextResponse.json(
    {
      ok: true,
      deletedItemId: itemId,
      deletedProductOptionId: productOptionId,
      deletedProductId: productId,
    },
    { status: 200 },
  );
}
