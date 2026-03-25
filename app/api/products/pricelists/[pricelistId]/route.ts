import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getPriceListById } from "@/lib/products/priceLists";

function centsToNokString(cents: number) {
  return Math.round(cents / 100).toString();
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
        items: priceList.items.map((item) => ({
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
          isActive: item.isActive,
        })),
      },
    },
    { status: 200 },
  );
}
