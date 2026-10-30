import {
  parseAdjustmentLines,
  sumAdjustmentLines,
  type AdjustmentLine,
} from "@/lib/booking/pricing/adjustmentLines";

// The website order calculator (WebsiteOrderCalculator) uses the booking
// app's adjustment lines: several discounts / extras / partner minus / plus,
// each with a description. The save routes (website-items, moving-details,
// service-details) keep pricing from the four summed fields, as before — the
// lines only add the breakdown, stored in pricingSnapshot.adjustmentLines like
// a regular order's (read back with storedAdjustmentLines).

export type SubmittedAdjustmentLines =
  | { ok: true; lines: AdjustmentLine[] | null; handling: unknown }
  | { ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// A save's `adjustmentLines`, when sent: their per-kind sums are laid over the
// `handling` fields, so the stored fields always add up to the stored lines.
// Without lines (older callers) the body's handling is used as it is.
export function readSubmittedAdjustmentLines(
  body: { handling?: unknown; adjustmentLines?: unknown } | null,
): SubmittedAdjustmentLines {
  if (body?.adjustmentLines === undefined) return { ok: true, lines: null, handling: body?.handling };

  const lines = parseAdjustmentLines(body.adjustmentLines);
  if (!lines) return { ok: false };

  return {
    ok: true,
    lines,
    handling: { ...(isRecord(body.handling) ? body.handling : {}), ...sumAdjustmentLines(lines) },
  };
}

// The pricing snapshot a save writes, with the lines on it.
export function withAdjustmentLines<T>(snapshot: T, lines: AdjustmentLine[]): T & { adjustmentLines: AdjustmentLine[] } {
  return { ...(isRecord(snapshot) ? snapshot : {}), adjustmentLines: lines } as T & { adjustmentLines: AdjustmentLine[] };
}
