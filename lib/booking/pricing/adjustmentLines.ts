import type { CalculatorAdjustments } from "./types";

// Manual calculator adjustments, one row each with its own description.
// Amounts are always positive; the kind decides whether a line subtracts
// (discount / subcontractorMinus) or adds (extra / subcontractorPlus).
// The legacy single-value Order fields (rabatt/leggTil/subcontractorMinus/
// subcontractorPlus) are kept as the per-kind sums, so totals, GSM, archive
// columns etc. keep reading them unchanged. The lines themselves live in
// Order.pricingSnapshot.adjustmentLines.
export type AdjustmentLineKind = "discount" | "extra" | "subcontractorMinus" | "subcontractorPlus";

export type AdjustmentLine = {
  id: string;
  kind: AdjustmentLineKind;
  description: string;
  amount: number;
  // Set on a partner minus line that was auto-created alongside a customer
  // discount line, so removing the discount removes it too.
  sourceId?: string;
  // Entered as a percentage (see adjustmentLineBase). `amount` always holds
  // the resulting NOK value; the percent is kept for display and re-editing.
  percent?: number;
};

const SUBTRACTING_KINDS: AdjustmentLineKind[] = ["discount", "subcontractorMinus"];

const KIND_TO_FIELD: Record<AdjustmentLineKind, keyof CalculatorAdjustments> = {
  discount: "rabatt",
  extra: "leggTil",
  subcontractorMinus: "subcontractorMinus",
  subcontractorPlus: "subcontractorPlus",
};

const KINDS = Object.keys(KIND_TO_FIELD) as AdjustmentLineKind[];

function roundNok(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseNok(value: string | null | undefined) {
  if (!value) return 0;
  const n = Number(value.replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function createAdjustmentLineId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `adj-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function sumAdjustmentLines(lines: AdjustmentLine[]): CalculatorAdjustments {
  const sums: Record<keyof CalculatorAdjustments, number> = {
    rabatt: 0,
    leggTil: 0,
    subcontractorMinus: 0,
    subcontractorPlus: 0,
  };

  for (const line of lines) {
    const field = KIND_TO_FIELD[line.kind];
    sums[field] = roundNok(sums[field] + line.amount);
  }

  const toText = (n: number) => (n === 0 ? "" : String(n));
  return {
    rabatt: toText(sums.rabatt),
    leggTil: toText(sums.leggTil),
    subcontractorMinus: toText(sums.subcontractorMinus),
    subcontractorPlus: toText(sums.subcontractorPlus),
  };
}

// Sanitizes untrusted input (request bodies, stored snapshots). Returns null
// when the value isn't an array at all, so callers can tell "not provided"
// apart from "provided, but empty".
export function parseAdjustmentLines(value: unknown): AdjustmentLine[] | null {
  if (!Array.isArray(value)) return null;

  const lines: AdjustmentLine[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;

    const kind = record.kind;
    if (typeof kind !== "string" || !KINDS.includes(kind as AdjustmentLineKind)) continue;

    const amount = typeof record.amount === "number" ? record.amount : Number.NaN;
    if (!Number.isFinite(amount) || amount === 0) continue;

    const line: AdjustmentLine = {
      id: typeof record.id === "string" && record.id ? record.id : createAdjustmentLineId(),
      kind: kind as AdjustmentLineKind,
      description: typeof record.description === "string" ? record.description.trim().slice(0, 200) : "",
      amount: roundNok(Math.abs(amount)),
    };
    if (typeof record.sourceId === "string" && record.sourceId) {
      line.sourceId = record.sourceId;
    }
    if (typeof record.percent === "number" && Number.isFinite(record.percent) && record.percent > 0) {
      line.percent = roundNok(record.percent);
    }
    lines.push(line);
  }

  return lines;
}

const OPPOSITE_KIND: Record<AdjustmentLineKind, AdjustmentLineKind> = {
  discount: "extra",
  extra: "discount",
  subcontractorMinus: "subcontractorPlus",
  subcontractorPlus: "subcontractorMinus",
};

// Orders saved before adjustment lines existed only have the summed fields;
// show each as a single line without a description. Lines can't be negative,
// so a negative legacy value (e.g. leggTil "-890", used as a discount) becomes
// a line of the opposite kind with the same net effect.
export function adjustmentLinesFromLegacy(fields: {
  rabatt?: string | null;
  leggTil?: string | null;
  subcontractorMinus?: string | null;
  subcontractorPlus?: string | null;
}): AdjustmentLine[] {
  const lines: AdjustmentLine[] = [];
  for (const kind of KINDS) {
    const amount = roundNok(parseNok(fields[KIND_TO_FIELD[kind]]));
    if (amount === 0) continue;
    lines.push({
      id: `legacy-${kind}`,
      kind: amount < 0 ? OPPOSITE_KIND[kind] : kind,
      description: "",
      amount: Math.abs(amount),
    });
  }
  return lines;
}

// Lines to show for a saved order. Some writers (bulk edit, GSM webhook,
// cancelled-status cleanup) change the summed fields without touching the
// snapshot lines, so the stored lines are only trusted while they still add
// up to the stored fields.
export function storedAdjustmentLines(
  lines: AdjustmentLine[] | null,
  fields: Parameters<typeof adjustmentLinesFromLegacy>[0],
): AdjustmentLine[] {
  if (lines) {
    const sums = sumAdjustmentLines(lines);
    const matches = KINDS.every((kind) => {
      const field = KIND_TO_FIELD[kind];
      return roundNok(parseNok(sums[field])) === roundNok(parseNok(fields[field]));
    });
    if (matches) return lines;
  }
  return adjustmentLinesFromLegacy(fields);
}

type AdjustmentFields = {
  rabatt: string | null;
  leggTil: string | null;
  subcontractorMinus: string | null;
  subcontractorPlus: string | null;
};

// Server-side resolution for an order save. Submitted lines win and the
// summed fields are re-derived from them (so they can never disagree). A
// caller that only sends the summed fields (bulk edits, integrations) gets
// one undescribed line per field; a save that touches no adjustments keeps
// the order's existing lines.
export function resolveOrderAdjustments(params: {
  submittedLines: unknown;
  fields: AdjustmentFields;
  fieldsWereSubmitted: boolean;
  existingLines: AdjustmentLine[] | null;
}): { lines: AdjustmentLine[]; fields: AdjustmentFields } {
  const submitted = parseAdjustmentLines(params.submittedLines);
  if (submitted) {
    const sums = sumAdjustmentLines(submitted);
    const orNull = (value: string) => (value ? value : null);
    return {
      lines: submitted,
      fields: {
        rabatt: orNull(sums.rabatt),
        leggTil: orNull(sums.leggTil),
        subcontractorMinus: orNull(sums.subcontractorMinus),
        subcontractorPlus: orNull(sums.subcontractorPlus),
      },
    };
  }

  if (!params.fieldsWereSubmitted && params.existingLines) {
    return { lines: params.existingLines, fields: params.fields };
  }

  return { lines: adjustmentLinesFromLegacy(params.fields), fields: params.fields };
}

// Editor-side: adds an empty line that's edited in place, so totals update as
// the amount is typed. A customer discount also gets a linked partner minus
// line that follows it (see updateAdjustmentLine).
export function addAdjustmentLine(
  lines: AdjustmentLine[],
  kind: AdjustmentLineKind,
  createId: () => string = createAdjustmentLineId,
): AdjustmentLine[] {
  const line: AdjustmentLine = { id: createId(), kind, description: "", amount: 0 };
  if (kind !== "discount") return [...lines, line];
  return [
    ...lines,
    line,
    { id: createId(), kind: "subcontractorMinus", description: "", amount: 0, sourceId: line.id },
  ];
}

type LineTotals = { subtotalExVat: number; subcontractorBase: number };

// Linked partner minus lines give the partner the same percentage cut as
// their discount: discount / (customer running total before it) applied to
// the partner running total before the minus (see adjustmentLineBase).
// Recomputed after every line change so adding/removing an extra or plus
// during setup keeps them in step.
function syncLinkedMinusLines(lines: AdjustmentLine[], totals: LineTotals): AdjustmentLine[] {
  return lines.map((line) => {
    if (!line.sourceId) return line;
    const source = lines.find((candidate) => candidate.id === line.sourceId);
    if (!source || source.kind !== "discount") return line;
    const amount = proportionalSubcontractorMinus({
      discount: source.amount,
      subtotalExVat: adjustmentLineBase(lines, source, totals),
      subcontractorBase: adjustmentLineBase(lines, line, totals),
    });
    return amount === line.amount ? line : { ...line, amount };
  });
}

// What a percentage line is a percentage of: the running total on its side
// before this line — products plus every other line on that side (extras /
// partner plus added, discounts / partner minus subtracted). The linked
// partner minus is scaled with the same bases. A line never counts towards
// its own base.
export function adjustmentLineBase(lines: AdjustmentLine[], target: AdjustmentLine, totals: LineTotals): number {
  const isPartner = target.kind === "subcontractorMinus" || target.kind === "subcontractorPlus";
  const addKind: AdjustmentLineKind = isPartner ? "subcontractorPlus" : "extra";
  const subtractKind: AdjustmentLineKind = isPartner ? "subcontractorMinus" : "discount";

  const others = lines.reduce((sum, line) => {
    if (line.id === target.id) return sum;
    if (line.kind === addKind) return sum + line.amount;
    if (line.kind === subtractKind) return sum - line.amount;
    return sum;
  }, 0);
  return roundNok((isPartner ? totals.subcontractorBase : totals.subtotalExVat) + others);
}

export type AdjustmentLinePatch = {
  description?: string;
  amount?: number;
  percent?: number;
  // Switch the entry unit, converting the current value.
  unit?: "nok" | "percent";
};

function applyLinePatch(line: AdjustmentLine, patch: AdjustmentLinePatch, base: number): AdjustmentLine {
  const next: AdjustmentLine = { ...line };
  if (patch.description !== undefined) next.description = patch.description;

  const capPercent = (percent: number) =>
    SUBTRACTING_KINDS.includes(line.kind) ? Math.min(percent, 100) : percent;
  const setPercent = (percent: number) => {
    next.percent = roundNok(capPercent(Math.max(0, percent)));
    next.amount = roundNok((base * next.percent) / 100);
  };

  if (patch.unit === "percent") {
    setPercent(base > 0 ? (next.amount / base) * 100 : 0);
  } else if (patch.unit === "nok") {
    delete next.percent;
  }

  if (patch.percent !== undefined) {
    setPercent(patch.percent);
  }
  if (patch.amount !== undefined) {
    next.amount = patch.amount;
    delete next.percent;
  }

  // A value typed by hand on a linked partner minus unlinks it.
  if ((patch.amount !== undefined || patch.percent !== undefined) && next.sourceId) {
    delete next.sourceId;
  }
  return next;
}

// A linked partner minus mirrors its discount's description and follows its
// amount live; editing its amount by hand unlinks it.
export function updateAdjustmentLine(
  lines: AdjustmentLine[],
  id: string,
  patch: AdjustmentLinePatch,
  totals: LineTotals,
): AdjustmentLine[] {
  const target = lines.find((line) => line.id === id);
  if (!target) return lines;
  const base = adjustmentLineBase(lines, target, totals);

  const patched = lines.map((line) => {
    if (line.id === id) {
      return applyLinePatch(line, patch, base);
    }

    if (target.kind === "discount" && line.sourceId === id && patch.description !== undefined) {
      return { ...line, description: patch.description };
    }

    return line;
  });

  return syncLinkedMinusLines(patched, totals);
}

// The partner minus only follows its discount during initial setup (while the
// discount is a draft). Applying the discount — or loading a saved order,
// when no id is given — turns linked lines into independent ones.
export function unlinkAdjustmentLines(lines: AdjustmentLine[], sourceId?: string): AdjustmentLine[] {
  const shouldUnlink = (line: AdjustmentLine) =>
    Boolean(line.sourceId) && (sourceId === undefined || line.sourceId === sourceId);
  if (!lines.some(shouldUnlink)) return lines;

  return lines.map((line) => {
    if (!shouldUnlink(line)) return line;
    const next = { ...line };
    delete next.sourceId;
    return next;
  });
}

// Removes a line and any partner minus still linked to it.
export function removeAdjustmentLine(lines: AdjustmentLine[], id: string, totals: LineTotals): AdjustmentLine[] {
  return syncLinkedMinusLines(
    lines.filter((line) => line.id !== id && line.sourceId !== id),
    totals,
  );
}

export function proportionalSubcontractorMinus(params: {
  discount: number;
  subtotalExVat: number;
  subcontractorBase: number;
}): number {
  const { discount, subtotalExVat, subcontractorBase } = params;
  if (!(discount > 0) || !(subtotalExVat > 0)) return 0;
  return Math.round((subcontractorBase * discount) / subtotalExVat);
}
