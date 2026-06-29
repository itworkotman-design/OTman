export const TRANSPORT_PACKAGE_PRICELIST_ID =
  process.env.NEXT_PUBLIC_TRANSPORT_PRICELIST_ID ?? "c02196d7-c74a-43ac-bb7a-10fdbef7fd46";

export const transportPackageTypes = [
  "Pose",
  "Esker",
  "Kolli",
  "Halvpall",
  "Pall",
  "Konvolutt",
  "Ferskvarer / mat",
] as const;

export const transportDimensionLimits = {
  length: { min: 1, max: 400 },
  width: { min: 1, max: 240 },
  height: { min: 1, max: 240 },
  weight: { min: 0.1, max: 1500 },
} as const;

export const transportTimeWindows = ["10:00-16:00", "16:00-21:00"] as const;
