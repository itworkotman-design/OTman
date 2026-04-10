import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

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
  autoXtraPerPallet: boolean;
};

export async function getProductConfigMap(productIds: string[]) {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, ProductConfig>();
  }

  const rows = await prisma.$queryRaw<ProductConfig[]>(Prisma.sql`
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
      "autoXtraPerPallet"
    FROM "Product"
    WHERE "id" IN (${Prisma.join(uniqueIds)})
  `);

  return new Map(rows.map((row) => [row.id, row]));
}
