import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { getProductConfigMap } from "@/lib/products/productConfig";
import { prisma } from "@/lib/db";
import { getEffectivePrice } from "@/lib/products/discounts";
import type { ProductCustomSection } from "@/lib/products/customSections";
import type { ProductDeliveryType } from "@/lib/products/deliveryTypes";
import { parsePriceListSettings } from "@/lib/products/priceListSettings";

function centsToNokString(cents: number) {
  return Math.round(cents / 100).toString();
}

function toDateInputValue(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const { searchParams } = new URL(req.url);
  const requestedPriceListId = searchParams.get("priceListId");

  const membership = await getActiveMembership({
    userId: session.userId,
    companyId: session.activeCompanyId,
  });

  if (!membership) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const effectivePriceListId = requestedPriceListId || membership.priceListId;

  if (!effectivePriceListId) {
    return NextResponse.json({ ok: false, reason: "PRICE_LIST_NOT_ASSIGNED" }, { status: 409 });
  }

  const priceList = await prisma.priceList.findUnique({
    where: { id: effectivePriceListId },
    include: {
      items: {
        where: {
          isActive: true,
          productOption: {
            isActive: true,
            product: {
              isActive: true,
            },
          },
        },
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
      specialOptions: {
        where: {
          isActive: true,
        },
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
      },
    },
  });

  if (!priceList) {
    return NextResponse.json({ ok: false, reason: "PRICE_LIST_NOT_FOUND" }, { status: 404 });
  }

  const products = await prisma.product.findMany({
    where: {
      options: {
        some: {
          id: {
            in: priceList.items.map((item) => item.productOptionId),
          },
          isActive: true,
        },
      },
    },
    include: {
      options: {
        where: {
          isActive: true,
          id: {
            in: priceList.items.map((item) => item.productOptionId),
          },
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

  const productConfigMap = await getProductConfigMap(products.map((product) => product.id));

  const priceItemMap = new Map(priceList.items.map((item) => [item.productOptionId, item]));

  const productMap = new Map<
    string,
    {
      id: string;
      code: string;
      label: string;
      active: boolean;

      productType: string;
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

      options: Array<{
        id: string;
        code: string;
        label: string | null;
        description: string | null;
        category: string | null;
        customerPrice: string;
        subcontractorPrice: string;
        effectiveCustomerPrice: string;
        active: boolean;
      }>;
    }
  >();

  for (const product of products) {
    const productConfig = productConfigMap.get(product.id);

    if (!productMap.has(product.id)) {
      productMap.set(product.id, {
        id: product.id,
        code: product.code,
        label: product.name,
        active: product.isActive,

        productType: productConfig?.productType ?? product.productType,
        allowDeliveryTypes: productConfig?.allowDeliveryTypes ?? product.allowDeliveryTypes,
        allowInstallOptions: productConfig?.allowInstallOptions ?? product.allowInstallOptions,
        allowReturnOptions: productConfig?.allowReturnOptions ?? product.allowReturnOptions,
        allowExtraServices: productConfig?.allowExtraServices ?? product.allowExtraServices,
        allowDemont: productConfig?.allowDemont ?? product.allowDemont,
        allowQuantity: productConfig?.allowQuantity ?? product.allowQuantity,
        allowPeopleCount: productConfig?.allowPeopleCount ?? product.allowPeopleCount,
        allowHoursInput: productConfig?.allowHoursInput ?? product.allowHoursInput,
        allowModelNumber: productConfig?.allowModelNumber ?? product.allowModelNumber,
        autoXtraPerPallet: productConfig?.autoXtraPerPallet ?? product.autoXtraPerPallet,
        deliveryTypes: productConfig?.deliveryTypes ?? [],
        customSections: productConfig?.customSections ?? [],

        options: [],
      });
    }

    for (const option of product.options) {
      const priceItem = priceItemMap.get(option.id) ?? priceList.items.find((item) => item.productOptionId === option.id);
      const customerPriceCents = priceItem?.customerPriceCents ?? 0;
      const subcontractorPriceCents = priceItem?.subcontractorPriceCents ?? 0;
      const effectiveCustomerPriceCents = getEffectivePrice({
        basePrice: customerPriceCents,
        discountAmount: priceItem?.discountAmountCents ?? null,
        discountEndsAt: priceItem?.discountEndsAt ?? null,
      });
      if (!priceItem) {
        console.warn("Missing price item for option", {
          optionId: option.id,
          optionCode: option.code,
          priceListId: priceList.id,
        });
      }

      productMap.get(product.id)!.options.push({
        id: option.id,
        code: option.code,
        label: option.label,
        description: option.description,
        category: option.category,
        customerPrice: centsToNokString(customerPriceCents),
        subcontractorPrice: centsToNokString(subcontractorPriceCents),
        effectiveCustomerPrice: centsToNokString(effectiveCustomerPriceCents),
        active: option.isActive,
      });
    }
  }

  const specialOptions = priceList.specialOptions.map((option) => {
    const customerPriceNumber = Number(option.customerPrice);
    const discountAmountNumber = option.discountAmount === null ? null : Number(option.discountAmount);

    const effectiveCustomerPrice = getEffectivePrice({
      basePrice: customerPriceNumber,
      discountAmount: discountAmountNumber !== null && Number.isFinite(discountAmountNumber) ? discountAmountNumber : null,
      discountEndsAt: option.discountEndsAt,
    });

    return {
      id: option.id,
      type: option.type.toLowerCase(),
      code: option.code,
      label: option.label,
      description: option.description,
      customerPrice: String(option.customerPrice),
      subcontractorPrice: String(option.subcontractorPrice),
      discountAmount: option.discountAmount ?? "",
      discountEndsAt: toDateInputValue(option.discountEndsAt),
      effectiveCustomerPrice: String(effectiveCustomerPrice),
      active: option.isActive,
    };
  });

  return NextResponse.json(
    {
      ok: true,
      priceListId: priceList.id,
      priceListCode: priceList.code,
      priceListSettings: parsePriceListSettings(priceList.description),
      products: Array.from(productMap.values()),
      specialOptions,
    },
    { status: 200 },
  );
}
