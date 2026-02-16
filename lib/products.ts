export type Product = {
  id: string;
  label: string;
  active: boolean;
};

export const PRODUCTS: Product[] = [
  // White Goods
  { id: "WASH", label: "Vaskemaskin (Washing Machine)", active: true },
  { id: "DISH", label: "Oppvaskmaskin (Dishwasher)", active: true },
  { id: "DRYER", label: "Tørketrommel (Dryer)", active: true },
  { id: "FRIDGE", label: "Kjøleskap (Refrigerator)", active: true },
  { id: "FREEZER", label: "Fryser (Freezer)", active: true },
  { id: "SBS", label: "Side by Side", active: true },
  { id: "DRYINGCAB", label: "Tørkeskap (Drying Cabinet)", active: true },
  { id: "WINECAB", label: "Vinskap (Wine Cabinet)", active: true },
  
  // Kitchen Appliances
  { id: "OVEN", label: "Ovn (Stekeovn)", active: true },
  { id: "HOB", label: "Platetopp (Cooktop)", active: true },
  { id: "COOKER", label: "Komfyr (Stove)", active: true },
  { id: "FAN", label: "Ventilator", active: true },
  { id: "MICRO", label: "Mikrobølgeovn (Microwave)", active: true },
  
  // Electronics
  { id: "TV", label: "TV", active: true },
  
  // Delivery
  { id: "PALLET", label: "Pall (Pallet Delivery)", active: true },
  
  // Other
  { id: "OTHER", label: "Andre Produkter (Other Products)", active: true },
  { id: "ETTER", label: "Ettermontering", active: true},
  { id: "TIME", label: "Timepris", active: true},
  
];