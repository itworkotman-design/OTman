import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getEffectivePrice } from "@/lib/products/discounts";

type Body = {
  customerPrice?: string | number;
  subcontractorPrice?: string | number;
  isActive?: boolean;
  optionCode?: string;
  optionLabel?: string;
  description?: string | null;
  category?: string | null;
  productName?: string;
  discountAmount?: string | number | null;
  discountEndsAt?: string | null;
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
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return parsed * 100;
}

function centsToNokString(cents: number) {
  return Math.round(cents / 100).toString();
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function toDateInputValue(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
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

  const existing = await prisma.priceListItem.findUnique({
    where: { id: itemId },
    include: {
      productOption: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const priceListItemData: {
    customerPriceCents?: number;
    subcontractorPriceCents?: number;
    discountAmountCents?: number | null;
    discountEndsAt?: Date | null;
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

    priceListItemData.customerPriceCents = cents;
  }

  if (body.subcontractorPrice !== undefined) {
    const cents = parseNokToCents(body.subcontractorPrice);

    if (cents === null) {
      return NextResponse.json(
        { ok: false, reason: "INVALID_SUBCONTRACTOR_PRICE" },
        { status: 400 },
      );
    }

    priceListItemData.subcontractorPriceCents = cents;
  }

  if (body.discountAmount !== undefined) {
    if (body.discountAmount === null || body.discountAmount === "") {
      priceListItemData.discountAmountCents = null;
    } else {
      const cents = parseNokToCents(body.discountAmount);

      if (cents === null) {
        return NextResponse.json(
          { ok: false, reason: "INVALID_DISCOUNT_AMOUNT" },
          { status: 400 },
        );
      }

      priceListItemData.discountAmountCents = cents;
    }
  }

  if (body.discountEndsAt !== undefined) {
    priceListItemData.discountEndsAt = parseOptionalDate(body.discountEndsAt);
  }

  if (typeof body.isActive === "boolean") {
    priceListItemData.isActive = body.isActive;
  }

  const optionCode =
    typeof body.optionCode === "string" ? body.optionCode.trim() : undefined;
  const optionLabel =
    typeof body.optionLabel === "string" ? body.optionLabel.trim() : undefined;

  if (optionCode !== undefined && !optionCode) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_OPTION_CODE" },
      { status: 400 },
    );
  }

  if (optionLabel !== undefined && !optionLabel) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_OPTION_LABEL" },
      { status: 400 },
    );
  }

  if (optionCode && optionCode !== existing.productOption.code) {
    const duplicate = await prisma.productOption.findFirst({
      where: {
        productId: existing.productOption.productId,
        code: optionCode,
        id: {
          not: existing.productOption.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { ok: false, reason: "OPTION_CODE_ALREADY_EXISTS" },
        { status: 409 },
      );
    }
  }

  const productOptionData: {
    code?: string;
    label?: string;
    description?: string | null;
    category?: string | null;
  } = {};

  if (optionCode !== undefined) {
    productOptionData.code = optionCode;
  }

  if (optionLabel !== undefined) {
    productOptionData.label = optionLabel;
  }

  if (body.description !== undefined) {
    productOptionData.description = parseOptionalString(body.description);
  }

  if (body.category !== undefined) {
    productOptionData.category = parseOptionalString(body.category);
  }

  const productData: {
    name?: string;
  } = {};

  const productName =
    typeof body.productName === "string" ? body.productName.trim() : undefined;

  if (productName !== undefined) {
    if (!productName) {
      return NextResponse.json(
        { ok: false, reason: "INVALID_PRODUCT_NAME" },
        { status: 400 },
      );
    }

    productData.name = productName;
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (Object.keys(productData).length > 0) {
      await tx.product.update({
        where: { id: existing.productOption.productId },
        data: productData,
      });
    }

    if (Object.keys(productOptionData).length > 0) {
      await tx.productOption.update({
        where: { id: existing.productOption.id },
        data: productOptionData,
      });
    }

    if (Object.keys(priceListItemData).length > 0) {
      await tx.priceListItem.update({
        where: { id: itemId },
        data: priceListItemData,
      });
    }

    return tx.priceListItem.findUnique({
      where: { id: itemId },
      include: {
        productOption: {
          include: {
            product: true,
          },
        },
      },
    });
  });

  if (!updated) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const effectiveCustomerPriceCents = getEffectivePrice({
    basePrice: updated.customerPriceCents,
    discountAmount: updated.discountAmountCents,
    discountEndsAt: updated.discountEndsAt,
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
        discountAmount:
          updated.discountAmountCents === null
            ? ""
            : centsToNokString(updated.discountAmountCents),
        discountEndsAt: toDateInputValue(updated.discountEndsAt),
        effectiveCustomerPrice: centsToNokString(effectiveCustomerPriceCents),
        isActive: updated.isActive,
      },
    },
    { status: 200 },
  );
}
