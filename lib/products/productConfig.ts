import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  normalizeProductCustomSections,
  type ProductCustomSection,
} from "@/lib/products/customSections";
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
  deliveryTypes: ProductDeliveryType[];
  customSections: ProductCustomSection[];
};

function isMissingProductConfigColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes(`column "deliveryTypes" does not exist`) ||
    message.includes(`column "deliverytypes" does not exist`) ||
    message.includes(`column "allowModelNumber" does not exist`) ||
    message.includes(`column "allowmodelnumber" does not exist`)
  );
}

export async function getProductConfigMap(productIds: string[]) {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, ProductConfig>();
  }

  let rows: Array<
    Omit<ProductConfig, "deliveryTypes" | "customSections"> & {
      deliveryTypes: Prisma.JsonValue | null;
      customSections: Prisma.JsonValue | null;
    }
  >;

  try {
    rows = await prisma.$queryRaw<
      Array<
        Omit<ProductConfig, "deliveryTypes" | "customSections"> & {
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
        Omit<ProductConfig, "allowModelNumber" | "deliveryTypes" | "customSections"> & {
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
      deliveryTypes: createDefaultProductDeliveryTypes(),
    }));
  }

  return new Map(
    rows.map((row) => [
      row.id,
      {
        ...row,
        deliveryTypes: normalizeProductDeliveryTypes(row.deliveryTypes),
        customSections: normalizeProductCustomSections(row.customSections),
      },
    ]),
  );
}
