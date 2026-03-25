import { prisma } from "@/lib/db";

export async function getPriceListById(priceListId: string) {
  return prisma.priceList.findUnique({
    where: { id: priceListId },
    include: {
      items: {
        include: {
          productOption: {
            include: {
              product: true,
            },
          },
        },
        orderBy: [
          {
            productOption: {
              product: {
                sortOrder: "asc",
              },
            },
          },
          {
            productOption: {
              sortOrder: "asc",
            },
          },
        ],
      },
    },
  });
}
