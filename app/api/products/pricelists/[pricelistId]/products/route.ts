import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { requireFullAccessMembership } from "@/lib/products/pricelistAccess";
import { prisma } from "@/lib/db";
import { getProductConfigMap } from "@/lib/products/productConfig";
import { OPTION_CATEGORIES } from "@/lib/booking/constants";
import { buildDeliveryTypesJson } from "@/lib/content/websiteDeliveryTypes";
import { parsePriceListSettings } from "@/lib/products/priceListSettings";

function generateCode(prefix: string) {
  return `${prefix}_${Date.now()}`;
}

function centsToNokString(cents: number) {
  return Math.round(cents / 100).toString();
}

const NO_PRICE = {
  customerPrice: 0,
  subcontractorPrice: 0,
  xtraPrice: 0,
  xtraSubcontractorPrice: 0,
};

// A delivery-only list's products are priced purely by their delivery types,
// so this creates the product with no option and no PriceListItem — just a
// PriceListProduct link. Same delivery-type defaults as the seeded
// parcel/pallet products (prices 0 until staff set them).
async function createDeliveryOnlyProduct(
  pricelistId: string,
  name: string,
  code: string,
) {
  const deliveryTypesJson = JSON.stringify(
    buildDeliveryTypesJson({
      deliveryTypes: { firstStep: NO_PRICE, indoor: NO_PRICE, installOnlyEnabled: false },
    }),
  );

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: { name, code, sortOrder: 999, isActive: true },
    });

    await tx.$executeRaw`
      UPDATE "Product"
      SET
        "productType" = ${"PHYSICAL"}::"ProductType",
        "allowDeliveryTypes" = true,
        "allowInstallOptions" = false,
        "allowReturnOptions" = false,
        "allowExtraServices" = false,
        "allowDemont" = false,
        "allowQuantity" = true,
        "allowPeopleCount" = false,
        "allowHoursInput" = false,
        "allowModelNumber" = true,
        "autoXtraPerPallet" = false,
        "deliveryTypes" = ${deliveryTypesJson}::jsonb
      WHERE "id" = ${created.id}
    `;

    await tx.priceListProduct.create({
      data: { priceListId: pricelistId, productId: created.id },
    });

    return created;
  });

  const { id: _id, ...config } = (await getProductConfigMap([product.id])).get(product.id) ?? {
    id: product.id,
  };

  return NextResponse.json(
    {
      ok: true,
      deliveryOnlyProduct: {
        ...config,
        productId: product.id,
        productName: product.name,
        productCode: product.code,
      },
    },
    { status: 201 },
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ pricelistId: string }> },
) {
  const session = await getAuthenticatedSession(req);

  const gate = await requireFullAccessMembership(session);
  if (!gate.ok) return gate.response;

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

  const priceList = await prisma.priceList.findUnique({
    where: { id: pricelistId },
    select: { description: true },
  });

  if (!priceList) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  if (parsePriceListSettings(priceList.description).deliveryOnly) {
    return createDeliveryOnlyProduct(pricelistId, name, productCode);
  }

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
        "allowModelNumber" = true,
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
        allowModelNumber: productConfig?.allowModelNumber ?? true,
        autoXtraPerPallet: productConfig?.autoXtraPerPallet ?? false,
        deliveryTypes: productConfig?.deliveryTypes ?? [],
        customSections: productConfig?.customSections ?? [],
      },
    },
    { status: 201 },
  );
}
