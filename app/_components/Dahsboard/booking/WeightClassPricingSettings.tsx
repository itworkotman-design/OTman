"use client";

import {
  createDefaultWeightClassPricing,
  type WeightClassPricing,
} from "@/lib/products/priceListSettings";
import { WEIGHT_CLASSES, WEIGHT_CLASS_LABELS, type WeightClass } from "@/lib/products/weightClass";

// Edit prices → pricelist settings: the website's floor surcharge (no lift,
// per chargeable floor — the order's heaviest item decides) and return price
// (per item), each by weight class. Off (null) = the flat floor surcharge and
// each return option's own price apply. See lib/booking/pricing/websiteWeightClass.ts.

type Props = {
  value: WeightClassPricing | null;
  onChange: (next: WeightClassPricing | null) => void;
};

type Charge = keyof WeightClassPricing;
type Field = "price" | "subcontractorPrice";

const COLUMNS: { charge: Charge; field: Field; label: string }[] = [
  { charge: "floorSurcharge", field: "price", label: "Floor price" },
  { charge: "floorSurcharge", field: "subcontractorPrice", label: "Floor partner" },
  { charge: "returnPrice", field: "price", label: "Return price" },
  { charge: "returnPrice", field: "subcontractorPrice", label: "Return partner" },
];

export default function WeightClassPricingSettings({ value, onChange }: Props) {
  function update(charge: Charge, weightClass: WeightClass, field: Field, next: string) {
    if (!value) return;
    onChange({
      ...value,
      [charge]: { ...value[charge], [weightClass]: { ...value[charge][weightClass], [field]: next } },
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-black/10 p-4">
      <h3 className="text-sm font-semibold text-logoblue">Weight classes</h3>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={(e) => onChange(e.target.checked ? createDefaultWeightClassPricing() : null)}
          className="background mt-0.5 h-4 w-4"
        />
        <span className="text-sm">
          Price floors and returns by weight class
          <span className="block text-xs text-black/60">
            Floor price is per floor with no lift, by the order&apos;s heaviest item. Return price is per item. A product
            without a weight class counts as light. Prices ex. VAT.
          </span>
        </span>
      </label>

      {value && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/60">
                <th className="py-1 pr-2 font-medium">Class</th>
                {COLUMNS.map((column) => (
                  <th key={`${column.charge}-${column.field}`} className="py-1 pr-2 font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEIGHT_CLASSES.map((weightClass) => (
                <tr key={weightClass}>
                  <td className="py-1 pr-2 whitespace-nowrap">
                    {WEIGHT_CLASS_LABELS[weightClass].en}
                    <span className="block text-xs text-black/50">{WEIGHT_CLASS_LABELS[weightClass].range}</span>
                  </td>
                  {COLUMNS.map((column) => (
                    <td key={`${column.charge}-${column.field}`} className="py-1 pr-2">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={value[column.charge][weightClass][column.field]}
                        onChange={(e) => update(column.charge, weightClass, column.field, e.target.value)}
                        className="customInput w-24"
                        aria-label={`${WEIGHT_CLASS_LABELS[weightClass].en} ${column.label}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
