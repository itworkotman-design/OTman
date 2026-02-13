"use client";

import { useMemo, useState } from "react";

function parseNOK(input: string) {
  const s = input.replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatNOK(n: number) {
  return `${n.toFixed(2)} NOK`;
}

export function CalculatorDisplay({ total }: { total: number }) {
  const [rabatt, setRabatt] = useState("");
  const [leggTil, setLegTil] = useState("");

  const discount = useMemo(() => parseNOK(rabatt), [rabatt]);
  const plus = useMemo(() => parseNOK(leggTil), [leggTil]);

  // totals are assumed EX VAT (uten MVA)
  const totalExVat = Math.max(0, total - discount + plus);
  const vat = totalExVat * 0.25;
  const totalIncVat = totalExVat + vat;

  return (
    <section className="w-140 border rounded-2xl px-4 max-h-[calc(100vh-9rem)] overflow-y-auto">
      <div className="border-b-2 py-4">
        <h1 className="font-bold text-md">Product name</h1>

        {/* Placeholder for breakdown - wire later */}
        <div className="priceRow">
          <h1>installasjon (montering)</h1>
          <p className="font-semibold">{formatNOK(0)}</p>
        </div>
        <div className="priceRow">
          <h1>Montering av vaskemaskin</h1>
          <p className="font-semibold">{formatNOK(0)}</p>
        </div>
        <div className="priceRow">
          <h1>Return til butikk</h1>
          <p className="font-semibold">{formatNOK(0)}</p>
        </div>
      </div>

      {/* Bottom half */}
      <div className="pb-4">
        <div className="priceRow">
          <h1 className="font-bold text-2xl">Total</h1>
          <p className="font-bold text-2xl">{formatNOK(totalExVat)}</p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">MVA (25%)</h1>
          <p className="font-semibold">{formatNOK(vat)}</p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">Total inkl. MVA</h1>
          <p className="font-semibold">{formatNOK(totalIncVat)}</p>
        </div>

        {/* edit mode block (keep as-is for now) */}
        <div id="editModeCalculator">
          <div className="mt-8 flex items-center">
            <h1>Rabatt (uten MVA): </h1>
            <input
              id="rabattInput"
              type="text"
              value={rabatt}
              onChange={(e) => setRabatt(e.target.value)}
              className="border ml-2 pl-2 h-8 rounded-md"
              placeholder="f.eks. 500"
            />
            <button
              id="btnBrukRabatt"
              type="button"
              disabled={!rabatt.trim()}
              className="border-2 border-logoblue text-logoblue py-1 px-4 ml-2 rounded-xl font-bold hover:bg-logoblue cursor-pointer hover:text-white disabled:hover:bg-white disabled:hover:text-logoblue disabled:opacity-40 disabled:cursor-auto"
            >
              Bruk rabatt
            </button>
          </div>

          <div className="mt-4 flex items-center">
            <h1>Ekstra (uten MVA): </h1>
            <input
              id="ekstraRabattInput"
              type="text"
              value={leggTil}
              onChange={(e) => setLegTil(e.target.value)}
              className="border ml-3 pl-2 h-8 rounded-md"
              placeholder="f.eks. 300"
            />
            <button
              id="btnLeggTil"
              type="button"
              disabled={!leggTil.trim()}
              className="border-2 border-logoblue text-logoblue py-1 px-4 ml-2 rounded-xl font-bold hover:bg-logoblue cursor-pointer hover:text-white disabled:hover:bg-white disabled:hover:text-logoblue disabled:opacity-40 disabled:cursor-auto"
            >
              Legg til
            </button>
          </div>

          <div className="mt-8 flex justify-evenly">
            <button
              id="btnSummary"
              type="button"
              className="w-full border-2 border-logoblue text-logoblue py-2 px-4 rounded-xl font-bold hover:bg-logoblue cursor-pointer hover:text-white"
            >
              Summary
            </button>
            <button
              id="btnSubcontractorSummary"
              type="button"
              className="w-full ml-8 border-2 border-logoblue text-logoblue py-2 px-4 rounded-xl font-bold hover:bg-logoblue cursor-pointer hover:text-white"
            >
              Subcontractor Summary
            </button>
          </div>

          <div className="mt-8 flex items-center">
            <h1>Subcontractor minus: </h1>
            <input
              id="subcontractorMinusInput"
              type="text"
              className="border ml-2 pl-2 h-8 rounded-md"
              placeholder="f.eks. 200"
            />
          </div>

          <div className="mt-8 flex items-center">
            <h1>Subcontractor plus: </h1>
            <input
              id="subcontractorPlusInput"
              type="text"
              className="border ml-5 pl-2 h-8 rounded-md"
              placeholder="f.eks. 200"
            />
          </div>

          <div id="existingOrderId" className="mt-8">
            <h1 className="text-xl font-semibold">Bestiller: POWER Skullerud</h1>
            <p>Ordre-ID: 13288</p>
          </div>
        </div>
      </div>
    </section>
  );
}
