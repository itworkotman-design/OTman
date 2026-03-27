import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { prisma } from "@/lib/db";

function centsToNokString(cents: number) {
  return Math.round(cents / 100).toString();
}

function getEffectiveCustomerPriceCents(item: {
  customerPriceCents: number;
  discountAmountCents: number | null;
  discountEndsAt: Date | null;
}) {
  const now = new Date();

  const hasActiveDiscount =
    item.discountAmountCents !== null &&
    item.discountEndsAt !== null &&
    item.discountEndsAt.getTime() > now.getTime();

  if (!hasActiveDiscount) {
    return item.customerPriceCents;
  }

  return Math.max(0, item.customerPriceCents - item.discountAmountCents!);
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
        label: string;
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

    const effectiveCustomerPriceCents = getEffectiveCustomerPriceCents({
      customerPriceCents: item.customerPriceCents,
      discountAmountCents: item.discountAmountCents,
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

  return NextResponse.json(
    {
      ok: true,
      priceListId: priceList.id,
      priceListCode: priceList.code,
      products: Array.from(productMap.values()),
    },
    { status: 200 },
  );
}
