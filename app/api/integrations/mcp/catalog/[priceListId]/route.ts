import { NextResponse } from "next/server";

import { authenticateMcpRequest } from "@/lib/integrations/mcp/authenticateMcpRequest";
import { prisma } from "@/lib/db";
import { getEffectivePrice } from "@/lib/products/discounts";

function centsToNokString(cents: number) {
  return Math.round(cents / 100).toString();
}

type RouteContext = { params: Promise<{ priceListId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const authentication = authenticateMcpRequest(request);

  if (!authentication.ok) {
    return NextResponse.json(
      { ok: false, reason: authentication.reason },
      { status: authentication.status },
    );
  }

  const { priceListId } = await context.params;

  try {
    const priceList = await prisma.priceList.findUnique({
      where: { id: priceListId },
      include: {
        items: {
          where: {
            isActive: true,
            productOption: { isActive: true, product: { isActive: true } },
          },
          include: { productOption: { include: { product: true } } },
        },
        specialOptions: { where: { isActive: true } },
      },
    });

    if (!priceList) {
      return NextResponse.json(
        { ok: false, reason: "PRICELIST_NOT_FOUND" },
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
          category: string | null;
          customerPrice: string;
          active: boolean;
        }>;
      }
    >();

    for (const item of priceList.items) {
      const option = item.productOption;
      const product = option.product;

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
        discountAmount: item.discountAmountCents ?? null,
        discountEndsAt: item.discountEndsAt ?? null,
      });

      productMap.get(product.id)!.options.push({
        id: option.id,
        code: option.code,
        label: option.label,
        category: option.category,
        customerPrice: centsToNokString(effectiveCustomerPriceCents),
        active: option.isActive,
      });
    }

    const specialOptions = priceList.specialOptions.map((option) => ({
      code: option.code,
      label: option.label,
      customerPrice: String(option.customerPrice),
      active: option.isActive,
    }));

    return NextResponse.json({
      pricelist: {
        id: priceList.id,
        code: priceList.code,
        name: priceList.name,
        products: Array.from(productMap.values()),
        specialOptions,
      },
    });
  } catch (error) {
    console.error("MCP catalog lookup failed", {
      priceListId,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
