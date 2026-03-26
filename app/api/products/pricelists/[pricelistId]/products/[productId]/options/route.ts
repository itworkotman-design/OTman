import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ pricelistId: string; productId: string }>;
  },
) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { pricelistId, productId } = await params;

  const body = await req.json().catch(() => ({}));

  const code =
    typeof body.code === "string" && body.code.trim()
      ? body.code.trim()
      : `OPT_${Date.now()}`;

  const label =
    typeof body.label === "string" && body.label.trim()
      ? body.label.trim()
      : "New option";

  const option = await prisma.productOption.create({
    data: {
      productId,
      code,
      label,
      description: null,
      category: null,
      sortOrder: 999,
      isActive: true,
    },
  });

  const item = await prisma.priceListItem.create({
    data: {
      priceListId: pricelistId,
      productOptionId: option.id,
      customerPriceCents: 0,
      subcontractorPriceCents: 0,
      isActive: true,
    },
    include: {
      productOption: {
        include: {
          product: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    item: {
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
      customerPrice: "0",
      subcontractorPrice: "0",
      isActive: item.isActive,
    },
  });
}
