import { prisma } from "@/lib/db";

export type ServiceCard = {
  id: string;
  title: string;
  description: string;
  pricingMode: "FIXED" | "REQUEST";
  priceCents: number | null;
  sortOrder: number;
};

export type CategorySection = {
  id: string;
  name: string;
  sortOrder: number;
  services: ServiceCard[];
};

export async function getPublicCatalog(): Promise<CategorySection[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      services: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          pricingMode: true,
          priceCents: true,
          sortOrder: true,
        },
      },
    },
  });

  // Hide empty categories from the public surface (keeps UX clean)
  return categories.filter((c) => c.services.length > 0);
}
