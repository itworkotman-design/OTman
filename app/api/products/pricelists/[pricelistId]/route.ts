import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getPriceListById } from "@/lib/products/priceLists";
import { prisma } from "@/lib/db";
import {
  getEffectivePrice,
  shouldClearExpiredDiscount,
} from "@/lib/products/discounts";

function centsToNokString(cents: number) {
  return Math.round(cents / 100).toString();
}

function toDateInputValue(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

async function clearExpiredDiscountIfNeeded(params: {
  kind: "item" | "special";
  id: string;
  discountEndsAt: Date | null;
}) {
  const { kind, id, discountEndsAt } = params;

  if (!shouldClearExpiredDiscount({ discountEndsAt })) return;

  if (kind === "item") {
    await prisma.priceListItem.update({
      where: { id },
      data: {
        discountAmountCents: null,
        discountEndsAt: null,
      },
    });
    return;
  }

  await prisma.priceListSpecialOption.update({
    where: { id },
    data: {
      discountAmount: null,
      discountEndsAt: null,
    },
  });
}

export async function GET(
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

  let priceList = await getPriceListById(pricelistId);

  if (!priceList) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  await Promise.all(
    priceList.items.map((item) =>
      clearExpiredDiscountIfNeeded({
        kind: "item",
        id: item.id,
        discountEndsAt: item.discountEndsAt,
      }),
    ),
  );

  await Promise.all(
    (priceList.specialOptions ?? []).map((option) =>
      clearExpiredDiscountIfNeeded({
        kind: "special",
        id: option.id,
        discountEndsAt: option.discountEndsAt,
      }),
    ),
  );

  priceList = await getPriceListById(pricelistId);

  if (!priceList) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      priceList: {
        id: priceList.id,
        name: priceList.name,
        code: priceList.code,
        description: priceList.description,
        isActive: priceList.isActive,

        items: priceList.items.map((item) => {
          const effectiveCustomerPriceCents = getEffectivePrice({
            basePrice: item.customerPriceCents,
            discountAmount: item.discountAmountCents,
            discountEndsAt: item.discountEndsAt,
          });

          return {
            id: item.id,
            productId: item.productOption.product.id,
            productOptionId: item.productOptionId,
            productName: item.productOption.product.name,
            productCode: item.productOption.product.code,
            optionCode: item.productOption.code,
            optionLabel: item.productOption.label,
            description: item.productOption.description,
            category: item.productOption.category,
            sortOrder: item.productOption.sortOrder,
            customerPrice: centsToNokString(item.customerPriceCents),
            subcontractorPrice: centsToNokString(item.subcontractorPriceCents),
            discountAmount:
              item.discountAmountCents === null
                ? ""
                : centsToNokString(item.discountAmountCents),
            discountEndsAt: toDateInputValue(item.discountEndsAt),
            effectiveCustomerPrice: centsToNokString(
              effectiveCustomerPriceCents,
            ),
            isActive: item.isActive,
          };
        }),

        specialOptions: (priceList.specialOptions ?? []).map((option) => {
          const customerPriceNumber = Number(option.customerPrice);
          const discountAmountNumber =
            option.discountAmount === null
              ? null
              : Number(option.discountAmount);

          const effectiveCustomerPrice = getEffectivePrice({
            basePrice: customerPriceNumber,
            discountAmount:
              discountAmountNumber !== null &&
              Number.isFinite(discountAmountNumber)
                ? discountAmountNumber
                : null,
            discountEndsAt: option.discountEndsAt,
          });

          return {
            id: option.id,

            // important for edit page classification
            type: option.type.toLowerCase(),
            category:
              option.type.toLowerCase() === "return"
                ? "return"
                : option.type.toLowerCase() === "xtra"
                  ? "xtra"
                  : option.type.toLowerCase() === "extra_service"
                    ? "extra_service"
                    : option.type.toLowerCase(),

            // important for edit page row shape
            code: option.code,
            optionCode: option.code,

            label: option.label,
            optionLabel: option.label,

            // keep product fields empty for special rows
            productId: undefined,
            productOptionId: undefined,
            productName: undefined,
            productCode: undefined,

            description: option.description,
            sortOrder: option.sortOrder,
            customerPrice: String(option.customerPrice),
            subcontractorPrice: String(option.subcontractorPrice),
            discountAmount: option.discountAmount ?? "",
            discountEndsAt: toDateInputValue(option.discountEndsAt),
            effectiveCustomerPrice: String(effectiveCustomerPrice),
            isActive: option.isActive,
          };
        }),
      },
    },
    { status: 200 },
  );
}

export async function PATCH(
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

  try {
    const { pricelistId } = await params;
    const body = await req.json().catch(() => null);

    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        { ok: false, reason: "NAME_REQUIRED" },
        { status: 400 },
      );
    }

    const existing = await prisma.priceList.findUnique({
      where: { id: pricelistId },
      select: {
        id: true,
        code: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, reason: "NOT_FOUND" },
        { status: 404 },
      );
    }

    if (existing.code === "DEFAULT") {
      return NextResponse.json(
        { ok: false, reason: "DEFAULT_NOT_EDITABLE" },
        { status: 400 },
      );
    }

    const updated = await prisma.priceList.update({
      where: { id: pricelistId },
      data: {
        name,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        priceList: updated,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Rename pricelist failed:", error);

    return NextResponse.json(
      { ok: false, reason: "UPDATE_FAILED" },
      { status: 500 },
    );
  }
}

