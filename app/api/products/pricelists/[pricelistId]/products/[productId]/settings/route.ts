import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requireFullAccessMembership } from "@/lib/products/pricelistAccess";
import { getProductConfigMap } from "@/lib/products/productConfig";
import { normalizeProductAutoDeliveryPrice } from "@/lib/products/autoDeliveryPrice";
import { normalizeProductCustomSections } from "@/lib/products/customSections";
import { normalizeProductDeliveryTypes } from "@/lib/products/deliveryTypes";

type Body = {
  name?: string;
  productType?: string;
  allowDeliveryTypes?: boolean;
  allowInstallOptions?: boolean;
  allowReturnOptions?: boolean;
  allowExtraServices?: boolean;
  allowDemont?: boolean;
  allowQuantity?: boolean;
  allowPeopleCount?: boolean;
  allowHoursInput?: boolean;
  allowModelNumber?: boolean;
  autoXtraPerPallet?: boolean;
  autoDeliveryPrice?: unknown;
  deliveryTypes?: unknown;
  customSections?: unknown;
};

const optionalBoolean = (value: unknown) => (typeof value === "boolean" ? value : null);

// Saves the settings (delivery-type prices included) of a delivery-only
// product — one with no ProductOption, so no PriceListItem for the
// items/[itemId]/full route to hang the update off. Only products linked to
// this price list via PriceListProduct are editable.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ pricelistId: string; productId: string }> },
) {
  const session = await getAuthenticatedSession(req);

  const gate = await requireFullAccessMembership(session);
  if (!gate.ok) return gate.response;

  const { pricelistId, productId } = await params;
  const body = ((await req.json().catch(() => null)) ?? {}) as Body;

  const link = await prisma.priceListProduct.findUnique({
    where: { priceListId_productId: { priceListId: pricelistId, productId } },
    select: { id: true },
  });

  if (!link) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : undefined;

  if (name !== undefined && !name) {
    return NextResponse.json({ ok: false, reason: "INVALID_PRODUCT_NAME" }, { status: 400 });
  }

  if (
    body.productType !== undefined &&
    body.productType !== "PHYSICAL" &&
    body.productType !== "PALLET" &&
    body.productType !== "LABOR"
  ) {
    return NextResponse.json({ ok: false, reason: "INVALID_PRODUCT_TYPE" }, { status: 400 });
  }

  const productType = body.productType ?? null;
  const autoDeliveryPriceJson =
    body.autoDeliveryPrice !== undefined
      ? JSON.stringify(normalizeProductAutoDeliveryPrice(body.autoDeliveryPrice))
      : null;
  const deliveryTypesJson =
    body.deliveryTypes !== undefined
      ? JSON.stringify(normalizeProductDeliveryTypes(body.deliveryTypes))
      : null;
  const customSectionsJson =
    body.customSections !== undefined
      ? JSON.stringify(normalizeProductCustomSections(body.customSections))
      : null;

  // Same raw update the items/[itemId]/full route uses: the runtime client can
  // lag behind the schema for the newer Product config columns.
  await prisma.$executeRaw`
    UPDATE "Product"
    SET
      "name" = COALESCE(${name ?? null}, "name"),
      "productType" = COALESCE(${productType}::"ProductType", "productType"),
      "allowDeliveryTypes" = COALESCE(${optionalBoolean(body.allowDeliveryTypes)}, "allowDeliveryTypes"),
      "allowQuantity" = COALESCE(${optionalBoolean(body.allowQuantity)}, "allowQuantity"),
      "allowInstallOptions" = COALESCE(${optionalBoolean(body.allowInstallOptions)}, "allowInstallOptions"),
      "allowReturnOptions" = COALESCE(${optionalBoolean(body.allowReturnOptions)}, "allowReturnOptions"),
      "allowExtraServices" = COALESCE(${optionalBoolean(body.allowExtraServices)}, "allowExtraServices"),
      "allowDemont" = COALESCE(${optionalBoolean(body.allowDemont)}, "allowDemont"),
      "allowPeopleCount" = COALESCE(${optionalBoolean(body.allowPeopleCount)}, "allowPeopleCount"),
      "allowHoursInput" = COALESCE(${optionalBoolean(body.allowHoursInput)}, "allowHoursInput"),
      "allowModelNumber" = COALESCE(${optionalBoolean(body.allowModelNumber)}, "allowModelNumber"),
      "autoXtraPerPallet" = COALESCE(${optionalBoolean(body.autoXtraPerPallet)}, "autoXtraPerPallet"),
      "autoDeliveryPrice" = COALESCE(${autoDeliveryPriceJson}::jsonb, "autoDeliveryPrice"),
      "deliveryTypes" = COALESCE(${deliveryTypesJson}::jsonb, "deliveryTypes"),
      "customSections" = COALESCE(${customSectionsJson}::jsonb, "customSections")
    WHERE "id" = ${productId}
  `;

  const config = (await getProductConfigMap([productId])).get(productId);

  return NextResponse.json({ ok: true, product: config ?? null }, { status: 200 });
}
