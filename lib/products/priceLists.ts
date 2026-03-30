import { prisma } from "@/lib/db";

export async function getPriceListById(priceListId: string) {
  return prisma.priceList.findUnique({
    where: { id: priceListId },
    include: {
      items: {
        orderBy: [
          { productOption: { product: { name: "asc" } } },
          { productOption: { sortOrder: "asc" } },
          { productOption: { code: "asc" } },
        ],
        include: {
          productOption: {
            include: {
              product: true,
            },
          },
        },
      },
      specialOptions: {
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
      },
    },
  });
}
