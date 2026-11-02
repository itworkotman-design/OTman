// Website product weight class (Product.weightClass / ProductOption.weightClass,
// the WeightClass enum): 1 = 0–25 kg, 2 = 26–75 kg, 3 = 75–150 kg. Prices the
// return and the no-lift floor surcharge — see
// lib/booking/pricing/websiteWeightClass.ts. Framework-free (no Prisma import)
// so the booking modal can use it too.

export const WEIGHT_CLASSES = ["LIGHT", "MEDIUM", "HEAVY"] as const;

export type WeightClass = (typeof WEIGHT_CLASSES)[number];

// What a product without a class counts as.
export const DEFAULT_WEIGHT_CLASS: WeightClass = "LIGHT";

export const WEIGHT_CLASS_LABELS: Record<WeightClass, { en: string; no: string; range: string }> = {
  LIGHT: { en: "Light", no: "Lett", range: "0–25 kg" },
  MEDIUM: { en: "Medium", no: "Middels", range: "26–75 kg" },
  HEAVY: { en: "Heavy", no: "Tung", range: "75–150 kg" },
};

export function normalizeWeightClass(value: unknown): WeightClass | null {
  return typeof value === "string" && (WEIGHT_CLASSES as readonly string[]).includes(value) ? (value as WeightClass) : null;
}

// The heavier of the given classes (an empty list counts as the default).
export function heaviestWeightClass(classes: WeightClass[]): WeightClass {
  return classes.reduce<WeightClass>(
    (heaviest, weightClass) => (WEIGHT_CLASSES.indexOf(weightClass) > WEIGHT_CLASSES.indexOf(heaviest) ? weightClass : heaviest),
    DEFAULT_WEIGHT_CLASS,
  );
}

// A request body's weightClass: missing = leave it, null = clear it, a known
// class = set it; anything else is invalid.
export function parseWeightClassInput(
  value: unknown,
): { ok: true; weightClass: WeightClass | null | undefined } | { ok: false } {
  if (value === undefined) return { ok: true, weightClass: undefined };
  if (value === null) return { ok: true, weightClass: null };
  const weightClass = normalizeWeightClass(value);
  return weightClass ? { ok: true, weightClass } : { ok: false };
}
