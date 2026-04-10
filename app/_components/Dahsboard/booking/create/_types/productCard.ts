import type { DeliveryType } from "@/lib/booking/pricing/types";

export type ProductType = "PHYSICAL" | "PALLET" | "LABOR";

export type SavedProductCard = {
  cardId: number;
  productId: string | null;

  deliveryType: DeliveryType;
  amount: number;
  peopleCount: number;
  hoursInput: number;

  selectedInstallOptionIds: string[];
  selectedExtraOptionIds: string[];
  selectedReturnOptionId: string | null;
  demontEnabled: boolean;

  selectedTimeOptionIds: string[];
  extraTimeHours: number;

  extraPalletEnabled: boolean;
  extraPalletQty: number;

  etterEnabled: boolean;
  etterQty: number;
};

export type CatalogOption = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  category: string | null;
  customerPrice: string;
  subcontractorPrice: string;
  effectiveCustomerPrice: string;
  active: boolean;
};

export type CatalogProduct = {
  id: string;
  code: string;
  label: string;
  active: boolean;
  productType: ProductType;
  allowDeliveryTypes: boolean;
  allowInstallOptions: boolean;
  allowReturnOptions: boolean;
  allowExtraServices: boolean;
  allowDemont: boolean;
  allowQuantity: boolean;
  allowPeopleCount: boolean;
  allowHoursInput: boolean;
  autoXtraPerPallet: boolean;
  options: CatalogOption[];
};

export type CatalogSpecialOption = {
  id: string;
  type: "return" | "xtra" | "extra_service";
  code: string;
  label: string | null;
  description: string | null;
  customerPrice: string;
  subcontractorPrice: string;
  effectiveCustomerPrice: string;
  active: boolean;
};

export function createEmptyProductCard(cardId: number): SavedProductCard {
  return {
    cardId,
    productId: null,

    deliveryType: "",
    amount: 1,
    peopleCount: 1,
    hoursInput: 1,

    selectedInstallOptionIds: [],
    selectedExtraOptionIds: [],
    selectedReturnOptionId: null,
    demontEnabled: false,

    selectedTimeOptionIds: [],
    extraTimeHours: 0.5,

    extraPalletEnabled: false,
    extraPalletQty: 1,

    etterEnabled: false,
    etterQty: 1,
  };
}

export function normalizeSavedProductCard(
  value: Partial<SavedProductCard> | null | undefined,
  fallbackCardId = 0,
): SavedProductCard {
  const base = createEmptyProductCard(value?.cardId ?? fallbackCardId);

  return {
    ...base,
    ...value,
    cardId: value?.cardId ?? fallbackCardId,
    productId: value?.productId ?? null,
    deliveryType: value?.deliveryType ?? "",
    amount:
      typeof value?.amount === "number" && Number.isFinite(value.amount)
        ? value.amount
        : base.amount,
    peopleCount:
      typeof value?.peopleCount === "number" && Number.isFinite(value.peopleCount)
        ? value.peopleCount
        : base.peopleCount,
    hoursInput:
      typeof value?.hoursInput === "number" && Number.isFinite(value.hoursInput)
        ? value.hoursInput
        : base.hoursInput,
    selectedInstallOptionIds: Array.isArray(value?.selectedInstallOptionIds)
      ? value.selectedInstallOptionIds
      : base.selectedInstallOptionIds,
    selectedExtraOptionIds: Array.isArray(value?.selectedExtraOptionIds)
      ? value.selectedExtraOptionIds
      : base.selectedExtraOptionIds,
    selectedReturnOptionId: value?.selectedReturnOptionId ?? null,
    demontEnabled:
      typeof value?.demontEnabled === "boolean"
        ? value.demontEnabled
        : base.demontEnabled,
    selectedTimeOptionIds: Array.isArray(value?.selectedTimeOptionIds)
      ? value.selectedTimeOptionIds
      : base.selectedTimeOptionIds,
    extraTimeHours:
      typeof value?.extraTimeHours === "number" &&
      Number.isFinite(value.extraTimeHours)
        ? value.extraTimeHours
        : base.extraTimeHours,
    extraPalletEnabled:
      typeof value?.extraPalletEnabled === "boolean"
        ? value.extraPalletEnabled
        : base.extraPalletEnabled,
    extraPalletQty:
      typeof value?.extraPalletQty === "number" &&
      Number.isFinite(value.extraPalletQty)
        ? value.extraPalletQty
        : base.extraPalletQty,
    etterEnabled:
      typeof value?.etterEnabled === "boolean"
        ? value.etterEnabled
        : base.etterEnabled,
    etterQty:
      typeof value?.etterQty === "number" && Number.isFinite(value.etterQty)
        ? value.etterQty
        : base.etterQty,
  };
}
