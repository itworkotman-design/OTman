//Products.ts
export type Product = {
  id: number;
  name: string;
  installCost: number;
};

export const PRODUCTS: Product[] = [
  { id: 1, name: "Vaskemaskin", installCost: 2490 },
  { id: 2, name: "Torketrommel", installCost: 439 },
  { id: 3, name: "Oppvaskmaskin", installCost: 2249 },
];
