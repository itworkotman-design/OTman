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
    }
  | {
      kind: "productOption";
      productOptionId: string;
      qty: number;
      priceOverride?: number;
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
  items: ProductCardLineItem[];
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
  totalExVat: number;
  vat: number;
  totalIncVat: number;
  subcontractorBase: number;
  subcontractorMinus: number;
  subcontractorPlus: number;
  subcontractorTotal: number;
};

export type CalculatedLine = {
  label: string;
  code?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type CalculatedBreakdown = {
  productName: string;
  productModelNumber?: string | null;
  lines: CalculatedLine[];
};

export type CalculatorResult = {
  breakdowns: CalculatedBreakdown[];
  totals: CalculatorTotals;
};
