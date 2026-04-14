import { prisma } from "@/lib/db";

function isMissingPriceListDescriptionColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes(`The column \`(not available)\` does not exist`) ||
    message.includes(`column "description" does not exist`) ||
    message.includes(`column "Description" does not exist`)
  );
}

async function findPriceListById(
  priceListId: string,
  includeDescription: boolean,
) {
  return prisma.priceList.findUnique({
    where: { id: priceListId },
    select: {
      id: true,
      name: true,
      code: true,
      ...(includeDescription ? { description: true } : {}),
      isActive: true,
      items: {
        orderBy: [
          { productOption: { product: { name: "asc" } } },
          { productOption: { sortOrder: "asc" } },
          { productOption: { code: "asc" } },
        ],
        select: {
          id: true,
          productOptionId: true,
          customerPriceCents: true,
          subcontractorPriceCents: true,
          discountAmountCents: true,
          discountEndsAt: true,
          isActive: true,
          productOption: {
            select: {
              id: true,
              code: true,
              label: true,
              description: true,
              category: true,
              sortOrder: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  productType: true,
                  allowDeliveryTypes: true,
                  allowInstallOptions: true,
                  allowReturnOptions: true,
                  allowExtraServices: true,
                  allowDemont: true,
                  allowQuantity: true,
                  allowPeopleCount: true,
                  allowHoursInput: true,
                  autoXtraPerPallet: true,
                },
              },
            },
          },
        },
      },
      specialOptions: {
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
        select: {
          id: true,
          type: true,
          code: true,
          label: true,
          description: true,
          customerPrice: true,
          subcontractorPrice: true,
          discountAmount: true,
          discountEndsAt: true,
          isActive: true,
          sortOrder: true,
        },
      },
    },
  });
}

export async function getPriceListById(priceListId: string) {
  try {
    return await findPriceListById(priceListId, true);
  } catch (error) {
    if (!isMissingPriceListDescriptionColumnError(error)) {
      throw error;
    }

    const priceList = await findPriceListById(priceListId, false);

    if (!priceList) {
      return null;
    }

    return {
      ...priceList,
      description: null,
    };
  }
}
