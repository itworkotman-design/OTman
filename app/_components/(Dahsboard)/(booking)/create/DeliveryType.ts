// DeliveryType.ts
import type { Product } from "./Products";

export type ReceiptRow = {
  name: string;
  code?: string;
  unitPrice: number;
};

export type DeliveryType = {
  id: number;
  name: string;        // shown in dropdown
  price: number;       // total price for this option (per 1 qty)
  receiptRows?: ReceiptRow[]; // how it should appear in the "check"
};

export const getDeliveryTypes = (product: Product): DeliveryType[] => {
  const installation = 590; // fixed
  const assembly = product.installCost; // product-specific

  return [
    {
      id: 1,
      name: "First step",
      price: 590,
      receiptRows: [{ name: "First step", unitPrice: 590 }],
    },
    {
      id: 2,
      name: "Bringing in",
      price: 669,
      receiptRows: [{ name: "Bringing in", unitPrice: 669 }],
    },
    {
      id: 3,
      name: "Kun Installasjon/Montering",
      price: installation + assembly,
      receiptRows: [
        {
          name: `Montering av ${product.name.toLowerCase()}`,
          code: "INSDISHW", // change per product if you have codes
          unitPrice: assembly,
        },
        { name: "Installasjon (Montering)", unitPrice: installation },
      ],
    },
    {
      id: 4,
      name: "Return",
      price: 255,
      receiptRows: [{ name: "Return", unitPrice: 255 }],
    },
  ];
};
