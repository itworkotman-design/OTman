import type { CalculatedLine, CalculatorResult } from "./types";

// "Use new price", row by row: an order priced with the catalog prices it was
// saved with against the same order priced with today's catalog. Only rows
// whose price actually moved are listed, so the notice says exactly what
// changed (and doesn't fire on a difference that isn't a price change). Used
// by the booking editor and the website-order modal alike.

export type PriceChangeRow = {
  // null for an order-level row (km, floors, extra pickups…).
  productName: string | null;
  label: string;
  saved: number;
  now: number;
  // null where the viewer may not see partner prices.
  savedPartner: number | null;
  nowPartner: number | null;
};

type Row = { productName: string | null; label: string; customer: number; partner: number };

function rows(result: CalculatorResult): Map<string, Row> {
  const map = new Map<string, Row>();
  result.breakdowns.forEach((breakdown, index) => {
    // Two cards of one product are told apart by card id.
    const owner = breakdown.isOrderExtras ? "extras" : breakdown.cardId !== undefined ? `card${breakdown.cardId}` : `product${index}`;
    for (const line of breakdown.lines) {
      map.set(`${owner}|${lineId(line)}`, {
        productName: breakdown.isOrderExtras ? null : breakdown.productName,
        label: line.label,
        customer: line.lineTotal,
        partner: line.subcontractorLineTotal ?? 0,
      });
    }
  });
  return map;
}

function lineId(line: CalculatedLine) {
  return line.lineKey ?? line.code ?? line.label;
}

// A row on only one side counts as 0 on the other.
export function diffCalculatorRows(saved: CalculatorResult, now: CalculatorResult): PriceChangeRow[] {
  const before = rows(saved);
  const after = rows(now);
  const changes: PriceChangeRow[] = [];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(key);
    const b = after.get(key);
    if ((a?.customer ?? 0) === (b?.customer ?? 0) && (a?.partner ?? 0) === (b?.partner ?? 0)) continue;
    const row = (b ?? a) as Row;
    changes.push({
      productName: row.productName,
      label: row.label,
      saved: a?.customer ?? 0,
      now: b?.customer ?? 0,
      savedPartner: a?.partner ?? 0,
      nowPartner: b?.partner ?? 0,
    });
  }
  return changes;
}
