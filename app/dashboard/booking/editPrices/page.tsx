/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import type React from "react";
import { useMemo, useState, useEffect } from "react";
//default
import { PRODUCTS_DEFAULT } from "@/lib/prices_default/productsDefault";
import { PRICE_OPTIONS_DEFAULT } from "@/lib/prices_default/priceOptionsDefault";
import { PRICE_ITEMS_DEFAULT } from "@/lib/prices_default/pricingDefault";
import type { PriceItem } from "@/lib/prices_default/pricingDefault";
import type { PriceOption } from "@/lib/prices_default/priceOptionsDefault";
//power
import { PRODUCTS_POWER } from "@/lib/prices_power/productsPower";
import { PRICE_OPTIONS_POWER } from "@/lib/prices_power/priceOptionsPower";
import { PRICE_ITEMS_POWER } from "@/lib/prices_power/pricingPower";

type Product = { id: string | number; label: string };

// Draft maps hold unsaved edits, keyed by their respective IDs.
// Nothing is committed to main state until the user presses "Update".
type PriceDrafts   = Record<string, Partial<PriceItem>>;
type OptionDrafts  = Record<string, Partial<PriceOption>>;
type ProductDrafts = Record<string, Partial<Product>>;

// ─────────────────────────────────────────────────────────────────────────────
// ID generation
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a unique string ID based on the current timestamp + random suffix. */
const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// If the new value equals the committed value the field is removed (no change to track), and if the entry becomes empty the entry itself is removed, causing the "Update" button to disappear automatically.
function setDraftField<T extends object>(
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, Partial<T>>>>,
  draftKey: string,
  field: keyof T,
  newValue: T[keyof T],
  committedValue: T[keyof T] | undefined
) {
  setDrafts((prev) => {
    const entry = { ...(prev[draftKey] ?? {}) } as Partial<T>;

    if (newValue === committedValue) {
      delete entry[field];
    } else {
      entry[field] = newValue;
    }

    if (Object.keys(entry).length === 0) {
      const { [draftKey]: _, ...rest } = prev;
      return rest as Record<string, Partial<T>>;
    }

    return { ...prev, [draftKey]: entry };
  });
}
//This is used to store which files for what category selected
const DATASETS = {
  default: {
    products: PRODUCTS_DEFAULT,
    options: PRICE_OPTIONS_DEFAULT,
    prices: PRICE_ITEMS_DEFAULT,
  },
  power: {
    products: PRODUCTS_POWER,
    options: PRICE_OPTIONS_POWER,
    prices: PRICE_ITEMS_POWER,
  }
} as const;

export default function EditPricesPage() {

const [activeTab, setActiveTab] = useState<keyof typeof DATASETS>("default");

const [products, setProducts] = useState<Product[]>(DATASETS.default.products as Product[]);
const [optionRows, setOptionRows] = useState<PriceOption[]>(DATASETS.default.options);
const [priceRows, setPriceRows] = useState<PriceItem[]>(DATASETS.default.prices);
// ── Draft (pending) state ────────────────────────────────────────────────
const [priceDrafts,   setPriceDrafts]   = useState<PriceDrafts>({});
const [optionDrafts,  setOptionDrafts]  = useState<OptionDrafts>({});
const [productDrafts, setProductDrafts] = useState<ProductDrafts>({});

// Track which rows are brand-new (never been committed).
// This keeps the "Update" button visible even when all fields are still empty (nothing is "dirty" yet, but the row still needs to be saved).
const [newOptionIds,  setNewOptionIds]  = useState<Set<string>>(new Set());
const [newProductIds, setNewProductIds] = useState<Set<string>>(new Set());

    // Group options by product for rendering
    const groupedByProduct = useMemo(() => {
        const map = new Map<string, PriceOption[]>();
        for (const option of optionRows) {
        const key = String(option.productId);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(option);
        }
        return Array.from(map.entries());
    }, [optionRows]);

    // Draft field change handlers

    const onPriceChange = <K extends keyof PriceItem>(priceKey: string, field: K, value: PriceItem[K]) => {
      const committed = priceRows.find((p) => p.key === priceKey);
      setDraftField(setPriceDrafts, priceKey, field, value, committed?.[field]);
    };

    const onOptionChange = <K extends keyof PriceOption>(
        optionId: string,
        field: K,
        value: PriceOption[K],
        committed: PriceOption
    ) => {setDraftField(setOptionDrafts, optionId, field, value, committed[field]);};

    const onProductLabelChange = (productId: string, value: string, committed: Product) => {setDraftField(setProductDrafts, productId, "label", value, committed.label);};

  // Commit (save) a row

    //Merges all pending drafts for a row into the committed state, then clears those drafts. Also commits the parent product name if it has a draft.
    const commitRow = (row: PriceOption) => {
    const optionId  = String(row.id);
    const productId = String(row.productId);

    const pricePatch   = priceDrafts[row.priceKey];
    const optionPatch  = optionDrafts[optionId];
    const productPatch = productDrafts[productId];

    if (pricePatch) {
      setPriceRows((prev) =>
        prev.map((p) => (p.key === row.priceKey ? { ...p, ...pricePatch } : p))
      );
      setPriceDrafts(({ [row.priceKey]: _, ...rest }) => rest);
    }

    if (optionPatch) {
      setOptionRows((prev) =>
        prev.map((o) => (String(o.id) === optionId ? { ...o, ...optionPatch } : o))
      );
      setOptionDrafts(({ [optionId]: _, ...rest }) => rest);
    }

    // Commit product name change when saving any row of that product
    if (productPatch) {
      setProducts((prev) =>
        prev.map((p) => (String(p.id) === productId ? { ...p, ...productPatch } : p))
      );
      setProductDrafts(({ [productId]: _, ...rest }) => rest);
    }

    // This row is no longer "new" once saved
    setNewOptionIds((prev)  => { const s = new Set(prev); s.delete(optionId);  return s; });
    setNewProductIds((prev) => { const s = new Set(prev); s.delete(productId); return s; });
  };

  // Add Option
const addOption = (productId: string) => {
    const optionId = newId();
    const priceKey = newId();

    const newPriceItem: PriceItem = {
        key: priceKey,
        code: "",
        label: "",
        customerPrice: 0,
        subcontractorPrice: 0,
        category: "install",
        active: false
    };

    const newOption: PriceOption = {
        id: optionId,
        productId: productId,
        priceKey: priceKey,
        active: true,
        kind: "install"
    };

    setPriceRows((prev)  => [...prev, newPriceItem]);
    setOptionRows((prev) => [...prev, newOption]);

    // Mark as new so "Update" stays visible even with empty fields
    setNewOptionIds((prev) => new Set(prev).add(optionId));
};

  // Add Product
const addProduct = () => {
    const productId = newId();
    const optionId  = newId();
    const priceKey  = newId();

    const newProduct: Product     = { id: productId, label: "" };
    const newPriceItem: PriceItem = {
        key: priceKey,
        code: "",
        label: "",
        customerPrice: 0,
        subcontractorPrice: 0,
        category: "install",
        active: false
    };
    const newOption: PriceOption  = {
        id: optionId,
        productId: productId,
        priceKey: priceKey,
        active: true,
        kind: "install"
    };

    setProducts((prev)   => [...prev, newProduct]);
    setPriceRows((prev)  => [...prev, newPriceItem]);
    setOptionRows((prev) => [...prev, newOption]);

    // Mark both product and option as new
    setNewOptionIds((prev)  => new Set(prev).add(String(optionId)));
    setNewProductIds((prev) => new Set(prev).add(String(productId)));
  };

useEffect(() => {
    const dataset = DATASETS[activeTab];
    console.log("Switching to:", activeTab);
    console.log("options count:", dataset.options.length);
    console.log("prices count:", dataset.prices.length);
    console.log("first option:", dataset.options[0]);
    console.log("first price:", dataset.prices[0]);

  setProducts(dataset.products as Product[]);
  setOptionRows(dataset.options);
  setPriceRows(dataset.prices);

  setPriceDrafts({});
  setOptionDrafts({});
  setProductDrafts({});
  setNewOptionIds(new Set());
  setNewProductIds(new Set());
}, [activeTab]);

const dirtyCellClass = "border-2 border-logoblue text-logoblue";

  return (
    <main className="p-6 w-full">
      <div className="mx-auto max-w-[1800]">
        {/*Title*/}
        <div className="mb-20">
          <h1 className="text-2xl font-bold text-center text-logoblue">Edit Prices</h1>
        </div>
        {/*DATASET Switch*/}
        <div id="activeTab" className="w-full">
          <div className="max-w-[500] mx-auto flex justify-center">
            {(["default", "power"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`mx-4 px-4 py-1 rounded-2xl border-2 border-logoblue font-semibold cursor-pointer transition-colors
                ${activeTab === tab
                  ? "bg-logoblue text-white"
                  : "text-logoblue hover:bg-logoblue hover:text-white"
                }`}
            >
              {tab}
            </button>
          ))}
          </div>
        </div>
        <div className="overflow-x-auto px-[100]">
          {/* ── Toolbar ── */}
          <div className="justify-self-end">
            <button
              className="btn bg-logoblue py-1 px-4 rounded-4xl mb-4 font-semibold text-white cursor-pointer hover:opacity-80 transition-opacity"
              onClick={addProduct}
            >
              Add Product
            </button>
            </div>

            {/* ── Main table ── */}
            <div className="overflow-visible">
              <table className="w-full table-fixed border border-black/10">
              <thead className="bg-gray-100">
                <tr className="text-left">
                  <th className="w-64 px-4 py-4 border bg-logoblue text-white font-semibold text-center">Product</th>
                  <th className="w-26 px-4 py-4 border bg-logoblue text-white font-semibold text-center">Option Label</th>
                  <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">Option Code</th>
                  <th className="w-60 px-4 py-4 border bg-logoblue text-white font-semibold text-center">Description</th>
                  <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">Customer Price</th>
                  <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">Subcontractor Price</th>
                  <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">Discount</th>
                  <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">Discount time</th>
                  <th className="w-22 px-4 py-4 border bg-logoblue text-white font-semibold text-center">Active</th>
                </tr>
              </thead>


              {/* One <tbody> per product, with a thick bottom border between groups */}
              {groupedByProduct.map(([productId, options]) => {
                const product        = products.find((p) => String(p.id) === productId);
                const isNewProduct   = newProductIds.has(productId);
                const productDraft   = productDrafts[productId] ?? {};
                const displayProduct = { ...(product ?? { id: productId, label: "" }), ...productDraft };

                return (
                  <tbody key={productId} className="group">
                    {options.map((row, idx) => {
                      const optionId = String(row.id);
                      const isNewRow = newOptionIds.has(optionId) || isNewProduct;

                      // Committed data for this row
                      const committedPrice  = priceRows.find((p) => p.key === row.priceKey);
                      const committedOption = row;

                      // Pending drafts for this row
                      const priceDraft  = priceDrafts[row.priceKey] ?? {};
                      const optionDraft = optionDrafts[optionId]    ?? {};

                      // Merge committed + draft so inputs always show the latest value
                      const displayPrice  = { ...(committedPrice ?? {}), ...priceDraft };
                      const displayOption = { ...committedOption,        ...optionDraft };

                      // Show "Update" if there are any pending changes OR the row is brand-new
                      const hasPendingChanges =
                        Object.keys(priceDraft).length   > 0 ||
                        Object.keys(optionDraft).length  > 0 ||
                        Object.keys(productDraft).length > 0 ||
                        isNewRow;

                      // Per-cell dirty flags — only highlight cells that actually changed
                      const dirty = {
                        code:               "code"               in priceDraft,
                        label:              "label"              in priceDraft,
                        customerPrice:      "customerPrice"      in priceDraft,
                        subcontractorPrice: "subcontractorPrice" in priceDraft,
                        discount:           "discount"           in priceDraft,
                        discountTime:       "discountTime"       in priceDraft,
                        active:             "active"             in optionDraft,
                        productLabel:       "label"              in productDraft,
                      };

                      return (
                        <tr
                          key={row.id}
                          className={`group relative align-middle ${
                            idx === options.length - 1
                              ? "border-b-2 border-logoblue"
                              : "border-b border-black/10"
                          }`}
                        >
                          {/* ── Product cell (only on the first option row; spans all option rows) ── */}
                          {idx === 0 && (
                            <td
                              className="
                                border-r border-logoblue/50 font-medium align-center relative
                                before:content-[''] before:absolute before:top-0 before:bottom-0
                                before:left-[-100] before:w-[200] before:bg-transparent
                              "
                              rowSpan={options.length}
                            >
                              <div className="flex flex-col gap-3 p-3">
                                <input
                                  className={`w-full text-center py-1 px-2 rounded focus:outline-none hover:bg-black/5 ${
                                    dirty.productLabel || isNewProduct
                                      ? dirtyCellClass
                                      : "border border-transparent"
                                  }`}
                                  placeholder="Product name…"
                                  value={displayProduct.label}
                                  onChange={(e) =>
                                    product && onProductLabelChange(productId, e.target.value, product)
                                  }
                                />

                                {/* "+" button: appears on row-group hover, adds a new blank option */}
                                <button
                                  type="button"
                                  title="Add option"
                                  className="
                                    cursor-pointer absolute -left-11 top-1/2 -translate-y-1/2
                                    w-6 h-6 text-sm rounded-full bg-white
                                    border-2 border-logoblue font-bold
                                    opacity-0 group-hover:opacity-100 transition-opacity z-10
                                    hover:text-white hover:bg-logoblue
                                  "
                                  onClick={() => addOption(productId)}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                          )}

                          {/* ── Option Label (read-only) ── */}
                          <td>
                            <input className="w-full py-2 px-2 hover:bg-black/2" value={`Install option: ${idx + 1}`} readOnly />
                          </td>

                          {/* ── Option Code ── */}
                          <td>
                            <input className={`w-full py-2 px-2 hover:bg-black/2 focus:outline-none ${dirty.code ? dirtyCellClass : ""}`} placeholder="e.g. OPT-01" value={(displayPrice.code as string) ?? ""} onChange={(e) => onPriceChange(row.priceKey, "code", e.target.value)} />
                          </td>

                          {/* ── Description ── */}
                          <td>
                            <input className={`w-full py-2 px-2 hover:bg-black/2 focus:outline-none ${dirty.label ? dirtyCellClass : ""}`} placeholder="Description…" value={(displayPrice.label as string) ?? ""} onChange={(e) => onPriceChange(row.priceKey, "label", e.target.value)} />
                          </td>

                          {/* ── Customer Price ── */}
                          <td>
                            <input type="number" className={`w-full py-2 px-2 hover:bg-black/2 focus:outline-none ${dirty.customerPrice ? dirtyCellClass : ""}`} value={(displayPrice.customerPrice as number) ?? 0} onChange={(e) => onPriceChange(row.priceKey, "customerPrice", Number(e.target.value)) } />
                          </td>

                          {/* ── Subcontractor Price ── */}
                          <td>
                            <input type="number" className={`w-full py-2 px-2 hover:bg-black/2 focus:outline-none ${dirty.subcontractorPrice ? dirtyCellClass : ""}`} value={(displayPrice.subcontractorPrice as number) ?? 0} onChange={(e) => onPriceChange(row.priceKey, "subcontractorPrice", Number(e.target.value)) } />
                          </td>
{/* ── Discount - have to make funcitoning── */}
                          <td>
                            <input type="number" className={`w-full py-2 px-2 hover:bg-black/2 focus:outline-none ${dirty.discount ? dirtyCellClass : ""}`} value={""} readOnly/>
                          </td>
{/* ── Discount Time - have to make funcitoning ── */}
                          <td>
                            <input type="number" className={`w-full py-2 px-2 hover:bg-black/2 focus:outline-none ${dirty.discountTime ? dirtyCellClass : ""}`} value={""} readOnly/>
                          </td>

                          {/* ── Active toggle + Update button ── */}
                          <td className="pr-2 relative">
                            <select
                              className={`w-full py-2 px-2 hover:bg-black/2 ${dirty.active ? dirtyCellClass : ""}`}
                              value={displayOption.active ? "active" : "disabled"}
                              onChange={(e) =>
                                onOptionChange(optionId, "active", e.target.value === "active", committedOption)
                              }
                            >
                              <option value="active">Active</option>
                              <option value="disabled">Disabled</option>
                            </select>

                            {/* "Update" button */}
                            {hasPendingChanges && (
                              <button
                                type="button"
                                className="
                                  cursor-pointer absolute right-[-80] top-1/2 -translate-y-1/2
                                  px-3 py-1 rounded-full bg-logoblue text-white font-semibold
                                "
                                onClick={() => commitRow(row)}
                              >
                                Update
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
              </table>
            </div>
          
        </div>
      </div>
    </main>
  );
}