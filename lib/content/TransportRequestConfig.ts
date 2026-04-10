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

export const transportTimeWindows = ["10-15", "15-21"] as const;
