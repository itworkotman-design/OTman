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

/**
 * Loads booking config for products. Delivery pricing (`deliveryTypes`,
 * `autoDeliveryPrice`, `customSections`) comes from the price list's own
 * `PriceListProductConfig` row when it has one, per field, falling back to the
 * product. Pass `null` only for flows that are not tied to a price list.
 */
export async function getProductConfigMap(
  productIds: string[],
  priceListId: string | null,
) {
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

  const overrides = priceListId
    ? new Map<string, PriceListPricingFields>(
        (
          await prisma.priceListProductConfig.findMany({
            where: { priceListId, productId: { in: uniqueIds } },
            select: {
              productId: true,
              autoDeliveryPrice: true,
              deliveryTypes: true,
              customSections: true,
            },
          })
        ).map((row) => [row.productId, row]),
      )
    : new Map<string, PriceListPricingFields>();

  return new Map(
    rows.map((row) => {
      const override = overrides.get(row.id);

      return [
        row.id,
        {
          ...row,
          autoDeliveryPrice: normalizeProductAutoDeliveryPrice(
            override?.autoDeliveryPrice ?? row.autoDeliveryPrice,
          ),
          deliveryTypes: normalizeProductDeliveryTypes(
            override?.deliveryTypes ?? row.deliveryTypes,
          ),
          customSections: normalizeProductCustomSections(
            override?.customSections ?? row.customSections,
          ),
        },
      ];
    }),
  );
}

type PriceListPricingFields = {
  autoDeliveryPrice: Prisma.JsonValue | null;
  deliveryTypes: Prisma.JsonValue | null;
  customSections: Prisma.JsonValue | null;
};

type PriceListProductConfigDb = Pick<
  Prisma.TransactionClient,
  "priceListProductConfig"
>;

/**
 * Saves delivery pricing on the price list's own row for a product. Only the
 * provided fields are written; it never touches the shared Product row.
 */
export async function savePriceListProductConfig(
  db: PriceListProductConfigDb,
  input: {
    priceListId: string;
    productId: string;
    autoDeliveryPrice?: ProductAutoDeliveryPrice;
    deliveryTypes?: ProductDeliveryType[];
    customSections?: ProductCustomSection[];
  },
) {
  const fields: Partial<Record<keyof PriceListPricingFields, Prisma.InputJsonValue>> = {};

  if (input.autoDeliveryPrice !== undefined) {
    fields.autoDeliveryPrice = input.autoDeliveryPrice;
  }
  if (input.deliveryTypes !== undefined) {
    fields.deliveryTypes = input.deliveryTypes;
  }
  if (input.customSections !== undefined) {
    fields.customSections = input.customSections;
  }

  if (Object.keys(fields).length === 0) return;

  await db.priceListProductConfig.upsert({
    where: {
      priceListId_productId: {
        priceListId: input.priceListId,
        productId: input.productId,
      },
    },
    create: {
      priceListId: input.priceListId,
      productId: input.productId,
      ...fields,
    },
    update: fields,
  });
}

/** Copies a price list's per-product delivery pricing onto a new price list. */
export async function copyPriceListProductConfigs(
  db: PriceListProductConfigDb,
  input: { fromPriceListId: string; toPriceListId: string },
) {
  const rows = await db.priceListProductConfig.findMany({
    where: { priceListId: input.fromPriceListId },
    select: {
      productId: true,
      autoDeliveryPrice: true,
      deliveryTypes: true,
      customSections: true,
    },
  });

  if (rows.length === 0) return;

  const json = (value: Prisma.JsonValue | null) =>
    value === null ? undefined : (value as Prisma.InputJsonValue);

  await db.priceListProductConfig.createMany({
    data: rows.map((row) => ({
      priceListId: input.toPriceListId,
      productId: row.productId,
      autoDeliveryPrice: json(row.autoDeliveryPrice),
      deliveryTypes: json(row.deliveryTypes),
      customSections: json(row.customSections),
    })),
    skipDuplicates: true,
  });
}
