export type DeliveryType =
  | ""
  | "FIRST_STEP"
  | "INDOOR"
  | "INSTALL_ONLY"
  | "RETURN_ONLY";

export type ProductCardLineItem =
  | {
      kind: "deliveryType";
      code: string;
      label: string;
      qty: number;
      unitPrice: number;
      subcontractorUnitPrice: number;
    }
  | {
      kind: "productOption";
      productOptionId: string;
      qty: number;
      priceOverride?: number;
      subcontractorPriceOverride?: number;
    }
  | {
      kind: "customPrice";
      code: string;
      label: string;
      qty: number;
      unitPrice: number;
      subcontractorUnitPrice?: number;
    }
  | {
      kind: "info";
      label: string;
      qty: number;
    };

export type ProductBreakdown = {
  productName: string;
  productModelNumber?: string | null;
  readOnly?: boolean;
  comment?: string | null;
  items: ProductCardLineItem[];
  cardId?: number;
  isOrderExtras?: boolean;
  nulledLineKeysForCustomer?: string[];
  nulledLineKeysForSubcontractor?: string[];
};

export type PriceLookup = Record<
  string,
  {
    label: string;
    code: string;
    customerPrice: number;
    subcontractorPrice: number;
  }
>;

export type CalculatorAdjustments = {
  rabatt: string;
  leggTil: string;
  subcontractorMinus: string;
  subcontractorPlus: string;
};

export type CalculatorTotals = {
  subtotalExVat: number;
  discount: number;
  extra: number;
  checkboxDiscount: number;
  totalExVat: number;
  vat: number;
  totalIncVat: number;
  subcontractorBase: number;
  subcontractorMinus: number;
  subcontractorPlus: number;
  subcontractorCheckboxDiscount: number;
  subcontractorTotal: number;
};

export type CalculatedLine = {
  label: string;
  code?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  subcontractorLineTotal?: number;
  lineKey?: string | null;
  nulledForCustomer?: boolean;
  nulledForSubcontractor?: boolean;
};

export type CalculatedBreakdown = {
  productName: string;
  productModelNumber?: string | null;
  readOnly?: boolean;
  comment?: string | null;
  lines: CalculatedLine[];
  cardId?: number;
  isOrderExtras?: boolean;
};

export type CalculatorResult = {
  breakdowns: CalculatedBreakdown[];
  totals: CalculatorTotals;
};
