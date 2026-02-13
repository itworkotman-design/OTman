export type Product = {
  id: string;
  label: string;  // shown in UI
  active: boolean;
};

export const PRODUCTS: Product[] = [
  {
    id: "WASH",
    label: "Washing Machine",
    active: true,
  },
  {
    id: "DISH",
    label: "Dishwasher",
    active: true,
  },
];
