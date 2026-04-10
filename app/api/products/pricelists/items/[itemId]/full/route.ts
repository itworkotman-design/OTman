import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getEffectivePrice } from "@/lib/products/discounts";
import { getProductConfigMap } from "@/lib/products/productConfig";
import {
  normalizeProductCustomSections,
  type ProductCustomSection,
} from "@/lib/products/customSections";

type Body = {
  customerPrice?: string | number;
  subcontractorPrice?: string | number;
  isActive?: boolean;
  optionCode?: string;
  optionLabel?: string;
  description?: string | null;
  category?: string | null;
  productName?: string;

  productType?: string;
  allowDeliveryTypes?: boolean;
  allowInstallOptions?: boolean;
  allowReturnOptions?: boolean;
  allowExtraServices?: boolean;
  allowDemont?: boolean;
  allowQuantity?: boolean;
  allowPeopleCount?: boolean;
  allowHoursInput?: boolean;
  autoXtraPerPallet?: boolean;
  customSections?: ProductCustomSection[];

  discountAmount?: string | number | null;
  discountEndsAt?: string | null;
};

function parseNokToCents(value: string | number): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value) * 100;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return parsed * 100;
}

function centsToNokString(cents: number) {
  return Math.round(cents / 100).toString();
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function toDateInputValue(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { itemId } = await params;
  const body = (await req.json()) as Body;


  const existing = await prisma.priceListItem.findUnique({
    where: { id: itemId },
    include: {
      productOption: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const priceListItemData: {
    customerPriceCents?: number;
    subcontractorPriceCents?: number;
    discountAmountCents?: number | null;
    discountEndsAt?: Date | null;
    isActive?: boolean;
  } = {};

  if (body.customerPrice !== undefined) {
    const cents = parseNokToCents(body.customerPrice);

    if (cents === null) {
      return NextResponse.json(
        { ok: false, reason: "INVALID_CUSTOMER_PRICE" },
        { status: 400 },
      );
    }

    priceListItemData.customerPriceCents = cents;
  }

  if (body.subcontractorPrice !== undefined) {
    const cents = parseNokToCents(body.subcontractorPrice);

    if (cents === null) {
      return NextResponse.json(
        { ok: false, reason: "INVALID_SUBCONTRACTOR_PRICE" },
        { status: 400 },
      );
    }

    priceListItemData.subcontractorPriceCents = cents;
  }

  if (body.discountAmount !== undefined) {
    if (body.discountAmount === null || body.discountAmount === "") {
      priceListItemData.discountAmountCents = null;
    } else {
      const cents = parseNokToCents(body.discountAmount);

      if (cents === null) {
        return NextResponse.json(
          { ok: false, reason: "INVALID_DISCOUNT_AMOUNT" },
          { status: 400 },
        );
      }

      priceListItemData.discountAmountCents = cents;
    }
  }

  if (body.discountEndsAt !== undefined) {
    priceListItemData.discountEndsAt = parseOptionalDate(body.discountEndsAt);
  }

  if (typeof body.isActive === "boolean") {
    priceListItemData.isActive = body.isActive;
  }

  const optionCode =
    typeof body.optionCode === "string" ? body.optionCode.trim() : undefined;
  const optionLabel =
    typeof body.optionLabel === "string" ? body.optionLabel.trim() : undefined;

  if (optionCode !== undefined && !optionCode) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_OPTION_CODE" },
      { status: 400 },
    );
  }

  if (optionLabel !== undefined && !optionLabel) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_OPTION_LABEL" },
      { status: 400 },
    );
  }

  if (optionCode && optionCode !== existing.productOption.code) {
    const duplicate = await prisma.productOption.findFirst({
      where: {
        productId: existing.productOption.productId,
        code: optionCode,
        id: {
          not: existing.productOption.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { ok: false, reason: "OPTION_CODE_ALREADY_EXISTS" },
        { status: 409 },
      );
    }
  }

  const productOptionData: {
    code?: string;
    label?: string;
    description?: string | null;
    category?: string | null;
  } = {};

  if (optionCode !== undefined) {
    productOptionData.code = optionCode;
  }

  if (optionLabel !== undefined) {
    productOptionData.label = optionLabel;
  }

  if (body.description !== undefined) {
    productOptionData.description = parseOptionalString(body.description);
  }

  if (body.category !== undefined) {
    productOptionData.category = parseOptionalString(body.category);
  }

  const productData: {
    name?: string;
    productType?: "PHYSICAL" | "PALLET" | "LABOR";
    allowDeliveryTypes?: boolean;
    allowInstallOptions?: boolean;
    allowReturnOptions?: boolean;
    allowExtraServices?: boolean;
    allowDemont?: boolean;
    allowQuantity?: boolean;
    allowPeopleCount?: boolean;
    allowHoursInput?: boolean;
    autoXtraPerPallet?: boolean;
    customSections?: ProductCustomSection[];
  } = {};

  const productName =
    typeof body.productName === "string" ? body.productName.trim() : undefined;

  if (productName !== undefined) {
    if (!productName) {
      return NextResponse.json(
        { ok: false, reason: "INVALID_PRODUCT_NAME" },
        { status: 400 },
      );
    }

    productData.name = productName;
  }

  if (body.productType !== undefined) {
    if (
      body.productType === "PHYSICAL" ||
      body.productType === "PALLET" ||
      body.productType === "LABOR"
    ) {
      productData.productType = body.productType;
    } else {
      return NextResponse.json(
        { ok: false, reason: "INVALID_PRODUCT_TYPE" },
        { status: 400 },
      );
    }
  }

  if (typeof body.allowDeliveryTypes === "boolean") {
    productData.allowDeliveryTypes = body.allowDeliveryTypes;
  }

  if (typeof body.allowInstallOptions === "boolean") {
    productData.allowInstallOptions = body.allowInstallOptions;
  }

  if (typeof body.allowReturnOptions === "boolean") {
    productData.allowReturnOptions = body.allowReturnOptions;
  }

  if (typeof body.allowExtraServices === "boolean") {
    productData.allowExtraServices = body.allowExtraServices;
  }

  if (typeof body.allowDemont === "boolean") {
    productData.allowDemont = body.allowDemont;
  }

  if (typeof body.allowQuantity === "boolean") {
    productData.allowQuantity = body.allowQuantity;
  }

  if (typeof body.allowPeopleCount === "boolean") {
    productData.allowPeopleCount = body.allowPeopleCount;
  }

  if (typeof body.allowHoursInput === "boolean") {
    productData.allowHoursInput = body.allowHoursInput;
  }

  if (typeof body.autoXtraPerPallet === "boolean") {
    productData.autoXtraPerPallet = body.autoXtraPerPallet;
  }

  if (body.customSections !== undefined) {
    productData.customSections = normalizeProductCustomSections(
      body.customSections,
    );
  }

  const customSectionsJson =
    productData.customSections !== undefined
      ? JSON.stringify(productData.customSections)
      : null;

  const updated = await prisma.$transaction(async (tx) => {
    if (Object.keys(productData).length > 0) {
      // Prisma's runtime client can lag behind the schema during dev, so use
      // a parameterized SQL update here for the newly added Product fields.
      await tx.$executeRaw`
        UPDATE "Product"
        SET
          "name" = COALESCE(${productData.name ?? null}, "name"),
          "productType" = COALESCE(${productData.productType ?? null}::"ProductType", "productType"),
          "allowDeliveryTypes" = COALESCE(${productData.allowDeliveryTypes ?? null}, "allowDeliveryTypes"),
          "allowQuantity" = COALESCE(${productData.allowQuantity ?? null}, "allowQuantity"),
          "allowInstallOptions" = COALESCE(${productData.allowInstallOptions ?? null}, "allowInstallOptions"),
          "allowReturnOptions" = COALESCE(${productData.allowReturnOptions ?? null}, "allowReturnOptions"),
          "allowExtraServices" = COALESCE(${productData.allowExtraServices ?? null}, "allowExtraServices"),
          "allowDemont" = COALESCE(${productData.allowDemont ?? null}, "allowDemont"),
          "allowPeopleCount" = COALESCE(${productData.allowPeopleCount ?? null}, "allowPeopleCount"),
          "allowHoursInput" = COALESCE(${productData.allowHoursInput ?? null}, "allowHoursInput"),
          "autoXtraPerPallet" = COALESCE(${productData.autoXtraPerPallet ?? null}, "autoXtraPerPallet"),
          "customSections" = COALESCE(${customSectionsJson}::jsonb, "customSections")
        WHERE "id" = ${existing.productOption.productId}
      `;
    }

    if (Object.keys(productOptionData).length > 0) {
      await tx.productOption.update({
        where: { id: existing.productOption.id },
        data: productOptionData,
      });
    }

    if (Object.keys(priceListItemData).length > 0) {
      await tx.priceListItem.update({
        where: { id: itemId },
        data: priceListItemData,
      });
    }

    return tx.priceListItem.findUnique({
      where: { id: itemId },
      include: {
        productOption: {
          include: {
            product: true,
          },
        },
      },
    });
  });

  if (!updated) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const effectiveCustomerPriceCents = getEffectivePrice({
    basePrice: updated.customerPriceCents,
    discountAmount: updated.discountAmountCents,
    discountEndsAt: updated.discountEndsAt,
  });

  const productConfigMap = await getProductConfigMap([
    updated.productOption.product.id,
  ]);
  const updatedProduct = updated.productOption.product;
  const rawProductConfig = productConfigMap.get(updatedProduct.id);
  const productSnapshot = {
    id: updatedProduct.id,
    name: updatedProduct.name ?? productData.name ?? existing.productOption.product.name,
    code: updatedProduct.code,
    productType:
      rawProductConfig?.productType ??
      updatedProduct.productType ??
      productData.productType ??
      existing.productOption.product.productType,
    allowDeliveryTypes:
      rawProductConfig?.allowDeliveryTypes ??
      updatedProduct.allowDeliveryTypes ??
      productData.allowDeliveryTypes ??
      existing.productOption.product.allowDeliveryTypes,
    allowQuantity:
      rawProductConfig?.allowQuantity ??
      updatedProduct.allowQuantity ??
      productData.allowQuantity ??
      existing.productOption.product.allowQuantity,
    allowInstallOptions:
      rawProductConfig?.allowInstallOptions ??
      updatedProduct.allowInstallOptions ??
      productData.allowInstallOptions ??
      existing.productOption.product.allowInstallOptions,
    allowReturnOptions:
      rawProductConfig?.allowReturnOptions ??
      updatedProduct.allowReturnOptions ??
      productData.allowReturnOptions ??
      existing.productOption.product.allowReturnOptions,
    allowExtraServices:
      rawProductConfig?.allowExtraServices ??
      updatedProduct.allowExtraServices ??
      productData.allowExtraServices ??
      existing.productOption.product.allowExtraServices,
    allowDemont:
      rawProductConfig?.allowDemont ??
      updatedProduct.allowDemont ??
      productData.allowDemont ??
      existing.productOption.product.allowDemont,
    allowPeopleCount:
      rawProductConfig?.allowPeopleCount ??
      updatedProduct.allowPeopleCount ??
      productData.allowPeopleCount ??
      existing.productOption.product.allowPeopleCount,
    allowHoursInput:
      rawProductConfig?.allowHoursInput ??
      updatedProduct.allowHoursInput ??
      productData.allowHoursInput ??
      existing.productOption.product.allowHoursInput,
    autoXtraPerPallet:
      rawProductConfig?.autoXtraPerPallet ??
      updatedProduct.autoXtraPerPallet ??
      productData.autoXtraPerPallet ??
      existing.productOption.product.autoXtraPerPallet,
    customSections:
      rawProductConfig?.customSections ??
      productData.customSections ??
      normalizeProductCustomSections(null),
  };

  return NextResponse.json(
    {
      ok: true,
      item: {
        id: updated.id,
        productId: productSnapshot.id,
        productOptionId: updated.productOptionId,
        productName: productSnapshot.name,
        productCode: productSnapshot.code,
        productType: productSnapshot.productType,
        allowDeliveryTypes: productSnapshot.allowDeliveryTypes,
        optionCode: updated.productOption.code,
        optionLabel: updated.productOption.label,
        description: updated.productOption.description,
        category: updated.productOption.category,
        sortOrder: updated.productOption.sortOrder,
        customerPrice: centsToNokString(updated.customerPriceCents),
        subcontractorPrice: centsToNokString(updated.subcontractorPriceCents),
        discountAmount:
          updated.discountAmountCents === null
            ? ""
            : centsToNokString(updated.discountAmountCents),
        discountEndsAt: toDateInputValue(updated.discountEndsAt),
        effectiveCustomerPrice: centsToNokString(effectiveCustomerPriceCents),
        isActive: updated.isActive,
        allowQuantity: productSnapshot.allowQuantity,
        allowInstallOptions: productSnapshot.allowInstallOptions,
        allowReturnOptions: productSnapshot.allowReturnOptions,
        allowExtraServices: productSnapshot.allowExtraServices,
        allowDemont: productSnapshot.allowDemont,
        allowPeopleCount: productSnapshot.allowPeopleCount,
        allowHoursInput: productSnapshot.allowHoursInput,
        autoXtraPerPallet: productSnapshot.autoXtraPerPallet,
        customSections: productSnapshot.customSections,
      },
    },
    { status: 200 },
  );
}
