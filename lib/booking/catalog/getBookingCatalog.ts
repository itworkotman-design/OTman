import { prisma } from "@/lib/db";
import type {
  CatalogProduct,
  CatalogSpecialOption,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

type Result = {
  products: CatalogProduct[];
  specialOptions: CatalogSpecialOption[];
};

function centsToDecimalString(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toFixed(2);
}

export async function getBookingCatalog(
  priceListId: string | null,
): Promise<Result> {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },
    include: {
      options: {
        where: {
          isActive: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  const priceListItems = priceListId
    ? await prisma.priceListItem.findMany({
        where: {
          priceListId,
          isActive: true,
        },
        select: {
          productOptionId: true,
          customerPriceCents: true,
          subcontractorPriceCents: true,
        },
      })
    : [];

  const priceListSpecialOptions = priceListId
    ? await prisma.priceListSpecialOption.findMany({
        where: {
          priceListId,
          isActive: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      })
    : [];

  const priceMap = new Map(
    priceListItems.map((item) => [
      item.productOptionId,
      {
        customerPriceCents: item.customerPriceCents,
        subcontractorPriceCents: item.subcontractorPriceCents,
      },
    ]),
  );

  const mappedProducts: CatalogProduct[] = products.map((product) => ({
    id: product.id,
    code: product.code,
    label: product.name,
    active: product.isActive,
    options: product.options.map((option) => {
      const price = priceMap.get(option.id);

      return {
        id: option.id,
        code: option.code,
        label: option.label,
        description: option.description,
        category: option.category,
        customerPrice: centsToDecimalString(price?.customerPriceCents),
        subcontractorPrice: centsToDecimalString(
          price?.subcontractorPriceCents,
        ),
        effectiveCustomerPrice: centsToDecimalString(price?.customerPriceCents),
        active: option.isActive,
      };
    }),
  }));

  const mappedSpecialOptions: CatalogSpecialOption[] =
    priceListSpecialOptions.map((option) => ({
      id: option.id,
      type:
        option.type === "RETURN"
          ? "return"
          : option.type === "XTRA"
            ? "xtra"
            : "extra_service",
      code: option.code,
      label: option.label,
      description: option.description,
      customerPrice: option.customerPrice.toString(),
      subcontractorPrice: option.subcontractorPrice.toString(),
      effectiveCustomerPrice: option.customerPrice.toString(),
      active: option.isActive,
    }));

  return {
    products: mappedProducts,
    specialOptions: mappedSpecialOptions,
  };
}
