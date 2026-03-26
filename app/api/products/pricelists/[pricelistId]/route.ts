import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getPriceListById } from "@/lib/products/priceLists";

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

function toDateInputValue(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
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

  const priceList = await getPriceListById(pricelistId);

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
          const effectiveCustomerPriceCents = getEffectiveCustomerPriceCents({
            customerPriceCents: item.customerPriceCents,
            discountAmountCents: item.discountAmountCents,
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
      },
    },
    { status: 200 },
  );
}
