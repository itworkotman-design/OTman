import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { prisma } from "@/lib/db";
import { getEffectivePrice } from "@/lib/products/discounts";

function centsToNokString(cents: number) {
  return Math.round(cents / 100).toString();
}

function toDateInputValue(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
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

  const membership = await getActiveMembership({
    userId: session.userId,
    companyId: session.activeCompanyId,
  });

  if (!membership) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  if (!membership.priceListId) {
    return NextResponse.json(
      { ok: false, reason: "PRICE_LIST_NOT_ASSIGNED" },
      { status: 409 },
    );
  }

  const priceList = await prisma.priceList.findUnique({
    where: { id: membership.priceListId },
    include: {
      items: {
        where: {
          isActive: true,
          productOption: {
            isActive: true,
            product: {
              isActive: true,
            },
          },
        },
        include: {
          productOption: {
            include: {
              product: true,
            },
          },
        },
        orderBy: [
          {
            productOption: {
              product: {
                sortOrder: "asc",
              },
            },
          },
          {
            productOption: {
              sortOrder: "asc",
            },
          },
        ],
      },
      specialOptions: {
        where: {
          isActive: true,
        },
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
      },
    },
  });

  if (!priceList) {
    return NextResponse.json(
      { ok: false, reason: "PRICE_LIST_NOT_FOUND" },
      { status: 404 },
    );
  }

  const productMap = new Map<
    string,
    {
      id: string;
      code: string;
      label: string;
      active: boolean;
      options: Array<{
        id: string;
        code: string;
        label: string | null;
        description: string | null;
        category: string | null;
        customerPrice: string;
        subcontractorPrice: string;
        effectiveCustomerPrice: string;
        active: boolean;
      }>;
    }
  >();

  for (const item of priceList.items) {
    const product = item.productOption.product;

    if (!productMap.has(product.id)) {
      productMap.set(product.id, {
        id: product.id,
        code: product.code,
        label: product.name,
        active: product.isActive,
        options: [],
      });
    }

    const effectiveCustomerPriceCents = getEffectivePrice({
      basePrice: item.customerPriceCents,
      discountAmount: item.discountAmountCents,
      discountEndsAt: item.discountEndsAt,
    });

    productMap.get(product.id)!.options.push({
      id: item.productOption.id,
      code: item.productOption.code,
      label: item.productOption.label,
      description: item.productOption.description,
      category: item.productOption.category,
      customerPrice: centsToNokString(item.customerPriceCents),
      subcontractorPrice: centsToNokString(item.subcontractorPriceCents),
      effectiveCustomerPrice: centsToNokString(effectiveCustomerPriceCents),
      active: item.isActive,
    });
  }

  const specialOptions = priceList.specialOptions.map((option) => {
    const customerPriceNumber = Number(option.customerPrice);
    const discountAmountNumber =
      option.discountAmount === null ? null : Number(option.discountAmount);

    const effectiveCustomerPrice = getEffectivePrice({
      basePrice: customerPriceNumber,
      discountAmount:
        discountAmountNumber !== null && Number.isFinite(discountAmountNumber)
          ? discountAmountNumber
          : null,
      discountEndsAt: option.discountEndsAt,
    });

    return {
      id: option.id,
      type: option.type.toLowerCase(),
      code: option.code,
      label: option.label,
      description: option.description,
      customerPrice: String(option.customerPrice),
      subcontractorPrice: String(option.subcontractorPrice),
      discountAmount: option.discountAmount ?? "",
      discountEndsAt: toDateInputValue(option.discountEndsAt),
      effectiveCustomerPrice: String(effectiveCustomerPrice),
      active: option.isActive,
    };
  });

  return NextResponse.json(
    {
      ok: true,
      priceListId: priceList.id,
      priceListCode: priceList.code,
      products: Array.from(productMap.values()),
      specialOptions,
    },
    { status: 200 },
  );
}
