import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  normalizeProductCustomSections,
  type ProductCustomSection,
} from "@/lib/products/customSections";
import {
  normalizeProductAutoDeliveryPrice,
  type ProductAutoDeliveryPrice,
} from "@/lib/products/autoDeliveryPrice";
import {
  createDefaultProductDeliveryTypes,
  normalizeProductDeliveryTypes,
  type ProductDeliveryType,
} from "@/lib/products/deliveryTypes";

export type ProductConfig = {
  id: string;
  productType: "PHYSICAL" | "PALLET" | "LABOR";
  allowDeliveryTypes: boolean;
  allowInstallOptions: boolean;
  allowReturnOptions: boolean;
  allowExtraServices: boolean;
  allowDemont: boolean;
  allowQuantity: boolean;
  allowPeopleCount: boolean;
  allowHoursInput: boolean;
  allowModelNumber: boolean;
  autoXtraPerPallet: boolean;
  autoDeliveryPrice: ProductAutoDeliveryPrice;
  deliveryTypes: ProductDeliveryType[];
  customSections: ProductCustomSection[];
};

function isMissingProductConfigColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes(`column "deliveryTypes" does not exist`) ||
    message.includes(`column "deliverytypes" does not exist`) ||
    message.includes(`column "allowModelNumber" does not exist`) ||
    message.includes(`column "allowmodelnumber" does not exist`) ||
    message.includes(`column "autoDeliveryPrice" does not exist`) ||
    message.includes(`column "autodeliveryprice" does not exist`)
  );
}

export async function getProductConfigMap(productIds: string[]) {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, ProductConfig>();
  }

  let rows: Array<
    Omit<ProductConfig, "autoDeliveryPrice" | "deliveryTypes" | "customSections"> & {
      autoDeliveryPrice: Prisma.JsonValue | null;
      deliveryTypes: Prisma.JsonValue | null;
      customSections: Prisma.JsonValue | null;
    }
  >;

  try {
    rows = await prisma.$queryRaw<
      Array<
        Omit<ProductConfig, "autoDeliveryPrice" | "deliveryTypes" | "customSections"> & {
          autoDeliveryPrice: Prisma.JsonValue | null;
          deliveryTypes: Prisma.JsonValue | null;
          customSections: Prisma.JsonValue | null;
        }
      >
    >(Prisma.sql`
      SELECT
        "id",
        "productType",
        "allowDeliveryTypes",
        "allowInstallOptions",
        "allowReturnOptions",
        "allowExtraServices",
        "allowDemont",
        "allowQuantity",
        "allowPeopleCount",
        "allowHoursInput",
        "allowModelNumber",
        "autoXtraPerPallet",
        "autoDeliveryPrice",
        "deliveryTypes",
        "customSections"
      FROM "Product"
      WHERE "id" IN (${Prisma.join(uniqueIds)})
    `);
  } catch (error) {
    if (!isMissingProductConfigColumnError(error)) {
      throw error;
    }

    const fallbackRows = await prisma.$queryRaw<
      Array<
        Omit<ProductConfig, "allowModelNumber" | "autoDeliveryPrice" | "deliveryTypes" | "customSections"> & {
          customSections: Prisma.JsonValue | null;
        }
      >
    >(Prisma.sql`
      SELECT
        "id",
        "productType",
        "allowDeliveryTypes",
        "allowInstallOptions",
        "allowReturnOptions",
        "allowExtraServices",
        "allowDemont",
        "allowQuantity",
        "allowPeopleCount",
        "allowHoursInput",
        "autoXtraPerPallet",
        "customSections"
      FROM "Product"
      WHERE "id" IN (${Prisma.join(uniqueIds)})
    `);

    rows = fallbackRows.map((row) => ({
      ...row,
      allowModelNumber: true,
      autoDeliveryPrice: null,
      deliveryTypes: createDefaultProductDeliveryTypes(),
    }));
  }

  return new Map(
    rows.map((row) => [
      row.id,
      {
        ...row,
        autoDeliveryPrice: normalizeProductAutoDeliveryPrice(
          row.autoDeliveryPrice,
        ),
        deliveryTypes: normalizeProductDeliveryTypes(row.deliveryTypes),
        customSections: normalizeProductCustomSections(row.customSections),
      },
    ]),
  );
}
