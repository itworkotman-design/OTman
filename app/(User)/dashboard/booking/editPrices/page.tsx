"use client";

import { useEffect, useMemo, useState } from "react";

type PriceListSummary = {
  id: string;
  name: string;
  code: string;
};

type PriceListItem = {
  id: string;
  productId: string;
  productInstallationOptionId: string;
  productName: string;
  productCode: string;
  installationOptionName: string;
  installationOptionCode: string;
  title: string | null;
  description: string | null;
  sortOrder: number;
  customerPrice: string;
  subcontractorPrice: string;
  isActive: boolean;
};

type EditableRow = PriceListItem & {
  saving?: boolean;
  saved?: boolean;
  error?: string | null;
};

type PriceListData = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  items: PriceListItem[];
};

export default function EditPricesPage() {
  const [activeTab, setActiveTab] = useState<"default" | "power">("default");
  const [priceLists, setPriceLists] = useState<PriceListSummary[]>([]);
  const [priceList, setPriceList] = useState<PriceListData | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [originalRows, setOriginalRows] = useState<
    Record<string, PriceListItem>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activePriceListSummary = useMemo(() => {
    const targetCode = activeTab === "default" ? "DEFAULT" : "POWER";
    return priceLists.find((item) => item.code === targetCode) ?? null;
  }, [activeTab, priceLists]);

  useEffect(() => {
    async function loadPriceLists() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/products/pricelists", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.reason ?? "Failed to load price lists");
          setPriceLists([]);
          return;
        }

        setPriceLists(data.priceLists ?? []);
      } catch {
        setError("Something went wrong while loading price lists");
        setPriceLists([]);
      } finally {
        setLoading(false);
      }
    }

    loadPriceLists();
  }, []);

  useEffect(() => {
    async function loadActivePriceList() {
      if (!activePriceListSummary) {
        setPriceList(null);
        setRows([]);
        setOriginalRows({});
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/products/pricelists/${activePriceListSummary.id}`,
          { cache: "no-store" },
        );

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.reason ?? "Failed to load price list");
          setPriceList(null);
          setRows([]);
          setOriginalRows({});
          return;
        }

        setPriceList(data.priceList);
        setRows(data.priceList.items);

        const originals = data.priceList.items.reduce(
          (acc: Record<string, PriceListItem>, item: PriceListItem) => {
            acc[item.id] = item;
            return acc;
          },
          {},
        );

        setOriginalRows(originals);
      } catch {
        setError("Something went wrong while loading price list");
        setPriceList(null);
        setRows([]);
        setOriginalRows({});
      } finally {
        setLoading(false);
      }
    }

    loadActivePriceList();
  }, [activePriceListSummary]);

  function updateRow(itemId: string, patch: Partial<EditableRow>) {
    setRows((current) =>
      current.map((row) =>
        row.id === itemId
          ? {
              ...row,
              ...patch,
              saved: false,
              error: null,
            }
          : row,
      ),
    );
  }

  function isDirty(row: EditableRow) {
    const original = originalRows[row.id];
    if (!original) return false;

    return (
      row.customerPrice !== original.customerPrice ||
      row.subcontractorPrice !== original.subcontractorPrice ||
      row.isActive !== original.isActive
    );
  }

  async function saveRow(itemId: string) {
    const row = rows.find((item) => item.id === itemId);
    if (!row) return;

    if (!row.customerPrice.trim()) {
      updateRow(itemId, { error: "Customer price is required" });
      return;
    }

    if (!row.subcontractorPrice.trim()) {
      updateRow(itemId, { error: "Subcontractor price is required" });
      return;
    }

    const customerNumber = Number(row.customerPrice);
    const subcontractorNumber = Number(row.subcontractorPrice);

    if (!Number.isFinite(customerNumber) || customerNumber < 0) {
      updateRow(itemId, { error: "Invalid customer price" });
      return;
    }

    if (!Number.isFinite(subcontractorNumber) || subcontractorNumber < 0) {
      updateRow(itemId, { error: "Invalid subcontractor price" });
      return;
    }

    try {
      updateRow(itemId, { saving: true, error: null, saved: false });

      const res = await fetch(`/api/products/pricelists/items/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerPrice: row.customerPrice,
          subcontractorPrice: row.subcontractorPrice,
          isActive: row.isActive,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        updateRow(itemId, {
          saving: false,
          saved: false,
          error: data.reason ?? "Failed to update row",
        });
        return;
      }

      setRows((current) =>
        current.map((item) =>
          item.id === itemId
            ? {
                ...data.item,
                saving: false,
                saved: true,
                error: null,
              }
            : item,
        ),
      );

      setOriginalRows((current) => ({
        ...current,
        [itemId]: data.item,
      }));

      setTimeout(() => {
        setRows((current) =>
          current.map((item) =>
            item.id === itemId ? { ...item, saved: false } : item,
          ),
        );
      }, 1800);
    } catch {
      updateRow(itemId, {
        saving: false,
        saved: false,
        error: "Something went wrong",
      });
    }
  }

  const grouped = useMemo(() => {
    return Object.values(
      rows.reduce(
        (acc, item) => {
          const key = item.productId;

          if (!acc[key]) {
            acc[key] = {
              productId: item.productId,
              productName: item.productName,
              productCode: item.productCode,
              items: [],
            };
          }

          acc[key].items.push(item);
          return acc;
        },
        {} as Record<
          string,
          {
            productId: string;
            productName: string;
            productCode: string;
            items: EditableRow[];
          }
        >,
      ),
    );
  }, [rows]);

  if (loading) {
    return (
      <main className="w-full">
        <div className="mx-auto max-w-[1800] p-6 text-center">Loading...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="w-full">
        <div className="mx-auto max-w-[1800] p-6 text-center text-red-600">
          {error}
        </div>
      </main>
    );
  }

  async function addOptionToProduct(productId: string) {
    if (!priceList) return;

    try {
      const res = await fetch(
        `/api/products/pricelists/${priceList.id}/products/${productId}/add-option`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            installationOptionCode: "INSTALL",
          }),
        },
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.reason ?? "Failed to add option");
        return;
      }

      const newItem = data.item as PriceListItem;

      setRows((current) => {
        const exists = current.some((item) => item.id === newItem.id);
        if (exists) return current;
        return [...current, newItem];
      });

      setOriginalRows((current) => ({
        ...current,
        [newItem.id]: newItem,
      }));
    } catch {
      alert("Something went wrong while adding option");
    }
  }

  return (
    <main className="w-full">
      <div className="mx-auto max-w-[1800]">
        <div className="mb-20">
          <h1 className="text-2xl font-bold text-center text-logoblue">
            Edit Prices
          </h1>
        </div>

        <div id="activeTab" className="w-full">
          <div className="max-w-[500] mx-auto flex justify-center mb-6">
            {(["default", "power"] as const).map((tab) => {
              const tabCode = tab === "default" ? "DEFAULT" : "POWER";
              const exists = priceLists.some((item) => item.code === tabCode);

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  disabled={!exists}
                  className={`mx-4 px-4 py-1 rounded-2xl border-2 border-logoblue font-semibold transition-colors ${
                    activeTab === tab
                      ? "bg-logoblue text-white"
                      : "bg-white text-logoblue"
                  } ${exists ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:pl-[50] lg:pr-[100]">
          <div className="mb-4 text-center">
            <h2 className="text-lg font-semibold text-logoblue">
              {priceList?.name ?? "Price List"}
            </h2>
            <p className="text-sm text-black/60">{priceList?.code}</p>
          </div>

          <div className="w-full overflow-x-auto lg:overflow-x-visible [-webkit-overflow-scrolling:touch]">
            <table className="w-full table-fixed border border-black/10">
              <thead className="bg-gray-100">
                <tr className="text-left">
                  <th className="w-64 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                    Product
                  </th>
                  <th className="w-26 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                    Option Label
                  </th>
                  <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                    Option Code
                  </th>
                  <th className="w-60 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                    Description
                  </th>
                  <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                    Customer Price
                  </th>
                  <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                    Subcontractor Price
                  </th>
                  <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                    Discount
                  </th>
                  <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                    Discount time
                  </th>
                  <th className="w-28 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                    Active
                  </th>
                </tr>
              </thead>

              {grouped.map((group) =>
                group.items.map((item, index) => (
                  <tbody key={item.id} className="group">
                    <tr className="group relative align-middle border-b-2 border-logoblue">
                      {index === 0 && (
                        <td
                          rowSpan={group.items.length}
                          className="border-r border-logoblue/50 font-medium align-center relative before:content-[''] before:absolute before:top-0 before:bottom-0 before:left-[-100] before:w-[200] before:bg-transparent"
                        >
                          <div className="flex flex-col gap-3 p-3">
                            <input
                              className="w-full text-center py-1 px-2 rounded focus:outline-none hover:bg-black/5"
                              value={group.productName}
                              readOnly
                            />

                            <button
                              type="button"
                              title="Add option"
                              onClick={() =>
                                addOptionToProduct(group.productId)
                              }
                              className="
                                    absolute -left-11 top-1/2 -translate-y-1/2
                                    w-6 h-6 text-sm rounded-full bg-white
                                    border-2 border-logoblue font-bold
                                    opacity-0 group-hover:opacity-100 transition-opacity z-10
                                    hover:text-white hover:bg-logoblue cursor-pointer
                                "
                            >
                              +
                            </button>
                          </div>
                        </td>
                      )}

                      <td>
                        <input
                          className="w-full py-2 px-2 hover:bg-black/2"
                          value={item.title ?? item.installationOptionName}
                          readOnly
                        />
                      </td>

                      <td>
                        <input
                          className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                          value={item.installationOptionCode}
                          readOnly
                        />
                      </td>

                      <td>
                        <input
                          className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                          value={item.description ?? ""}
                          readOnly
                        />
                      </td>

                      <td>
                        <div className="flex items-center">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                            value={item.customerPrice}
                            onChange={(e) =>
                              updateRow(item.id, {
                                customerPrice: e.target.value,
                              })
                            }
                          />
                        </div>
                      </td>

                      <td>
                        <div className="flex items-center">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                            value={item.subcontractorPrice}
                            onChange={(e) =>
                              updateRow(item.id, {
                                subcontractorPrice: e.target.value,
                              })
                            }
                          />
                        </div>
                      </td>

                      <td>
                        <input
                          type="text"
                          className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                          placeholder='"%" or number'
                        />
                      </td>

                      <td>
                        <input
                          type="date"
                          className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                        />
                      </td>

                      <td className="pr-2 relative">
                        <select
                          className="w-full py-2 px-2 hover:bg-black/2"
                          value={item.isActive ? "active" : "disabled"}
                          onChange={(e) =>
                            updateRow(item.id, {
                              isActive: e.target.value === "active",
                            })
                          }
                        >
                          <option value="active">Active</option>
                          <option value="disabled">Disabled</option>
                        </select>

                        {isDirty(item) && (
                          <button
                            type="button"
                            onClick={() => saveRow(item.id)}
                            disabled={item.saving}
                            className="customButtonEnabled absolute right-[-100] top-1/2 -translate-y-1/2"
                          >
                            {item.saving ? "Saving..." : "Update"}
                          </button>
                        )}

                        {!isDirty(item) && item.saved && (
                          <span className="absolute right-[-95] top-1/2 -translate-y-1/2 text-sm text-green-600 font-medium">
                            Saved
                          </span>
                        )}

                        {!isDirty(item) && item.error && (
                          <span className="absolute right-[-140] top-1/2 -translate-y-1/2 text-sm text-red-600 font-medium">
                            {item.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                )),
              )}
            </table>
          </div>

          <div className="justify-self-start">
            <button className="customButtonEnabled mt-4 mb-10">
              Add Product
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
