import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getProductConfigMap } from "@/lib/products/productConfig";
import { OPTION_CATEGORIES } from "@/lib/booking/constants";

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
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;
  const category =
    typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : OPTION_CATEGORIES.INSTALL;

  const option = await prisma.productOption.create({
    data: {
      productId,
      code,
      label,
      description,
      category,
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

  const productConfigMap = await getProductConfigMap([item.productOption.product.id]);
  const productConfig = productConfigMap.get(item.productOption.product.id);

  return NextResponse.json({
    ok: true,
    item: {
      id: item.id,
      productId: item.productOption.product.id,
      productOptionId: item.productOptionId,
      productName: item.productOption.product.name,
      productCode: item.productOption.product.code,
      productType: productConfig?.productType ?? item.productOption.product.productType,
      allowDeliveryTypes:
        productConfig?.allowDeliveryTypes ??
        item.productOption.product.allowDeliveryTypes,
      allowQuantity:
        productConfig?.allowQuantity ?? item.productOption.product.allowQuantity,
      allowInstallOptions:
        productConfig?.allowInstallOptions ??
        item.productOption.product.allowInstallOptions,
      allowReturnOptions:
        productConfig?.allowReturnOptions ??
        item.productOption.product.allowReturnOptions,
      allowExtraServices:
        productConfig?.allowExtraServices ??
        item.productOption.product.allowExtraServices,
      allowDemont:
        productConfig?.allowDemont ?? item.productOption.product.allowDemont,
      allowPeopleCount:
        productConfig?.allowPeopleCount ??
        item.productOption.product.allowPeopleCount,
      allowHoursInput:
        productConfig?.allowHoursInput ??
        item.productOption.product.allowHoursInput,
      autoXtraPerPallet:
        productConfig?.autoXtraPerPallet ??
        item.productOption.product.autoXtraPerPallet,
      deliveryTypes: productConfig?.deliveryTypes ?? [],
      customSections: productConfig?.customSections ?? [],
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
