import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getProductConfigMap } from "@/lib/products/productConfig";
import { OPTION_CATEGORIES } from "@/lib/booking/constants";

function generateCode(prefix: string) {
  return `${prefix}_${Date.now()}`;
}

function centsToNokString(cents: number) {
  return Math.round(cents / 100).toString();
}

export async function POST(
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

  const body = await req.json().catch(() => ({}));

  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : "New Product";

  const productCode =
    typeof body.code === "string" && body.code.trim()
      ? body.code.trim()
      : generateCode("PROD");

  const optionCode =
    typeof body.optionCode === "string" && body.optionCode.trim()
      ? body.optionCode.trim()
      : generateCode("OPT");

  const optionLabel =
    typeof body.optionLabel === "string" && body.optionLabel.trim()
      ? body.optionLabel.trim()
      : "Option: ";

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name,
        code: productCode,
        sortOrder: 999,
        isActive: true,
      },
    });

    await tx.$executeRaw`
      UPDATE "Product"
      SET
        "productType" = ${"PHYSICAL"}::"ProductType",
        "allowDeliveryTypes" = true,
        "allowInstallOptions" = true,
        "allowReturnOptions" = true,
        "allowExtraServices" = true,
        "allowDemont" = true,
        "allowQuantity" = true,
        "allowPeopleCount" = false,
        "allowHoursInput" = false,
        "autoXtraPerPallet" = false
      WHERE "id" = ${product.id}
    `;

    const productOption = await tx.productOption.create({
      data: {
        productId: product.id,
        code: optionCode,
        label: optionLabel,
        description: null,
        category: OPTION_CATEGORIES.INSTALL,
        sortOrder: 1,
        isActive: true,
      },
    });

    const item = await tx.priceListItem.create({
      data: {
        priceListId: pricelistId,
        productOptionId: productOption.id,
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

    return item;
  });

  const productConfigMap = await getProductConfigMap([
    result.productOption.product.id,
  ]);
  const productConfig = productConfigMap.get(result.productOption.product.id);

  return NextResponse.json(
    {
      ok: true,
      item: {
        id: result.id,
        productId: result.productOption.product.id,
        productOptionId: result.productOptionId,
        productName: result.productOption.product.name,
        productCode: result.productOption.product.code,
        productType: productConfig?.productType ?? "PHYSICAL",
        allowDeliveryTypes: productConfig?.allowDeliveryTypes ?? true,
        optionCode: result.productOption.code,
        optionLabel: result.productOption.label,
        description: result.productOption.description,
        category: result.productOption.category,
        sortOrder: result.productOption.sortOrder,
        customerPrice: centsToNokString(result.customerPriceCents),
        subcontractorPrice: centsToNokString(result.subcontractorPriceCents),
        isActive: result.isActive,
        allowQuantity: productConfig?.allowQuantity ?? true,
        allowInstallOptions: productConfig?.allowInstallOptions ?? true,
        allowReturnOptions: productConfig?.allowReturnOptions ?? true,
        allowExtraServices: productConfig?.allowExtraServices ?? true,
        allowDemont: productConfig?.allowDemont ?? true,
        allowPeopleCount: productConfig?.allowPeopleCount ?? false,
        allowHoursInput: productConfig?.allowHoursInput ?? false,
        autoXtraPerPallet: productConfig?.autoXtraPerPallet ?? false,
        deliveryTypes: productConfig?.deliveryTypes ?? [],
        customSections: productConfig?.customSections ?? [],
      },
    },
    { status: 201 },
  );
}
