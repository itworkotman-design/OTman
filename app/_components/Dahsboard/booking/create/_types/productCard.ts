import type { DeliveryType } from "@/lib/booking/pricing/types";
export type SavedProductCard = {
  cardId: number;
  productId: string | null;

  deliveryType: DeliveryType;
  amount: number;

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
  options: CatalogOption[];
};

export type CatalogSpecialOption = {
  id: string;
  type: "return" | "xtra";
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
