"use client";

import { useEffect, useMemo, useState } from "react";
import { OPTION_CATEGORIES, OPTION_CODES } from "@/lib/booking/constants";
import { isReturnOption, isXtraOption } from "@/lib/booking/pricing/rules";

type PriceListSummary = {
  id: string;
  name: string;
  code: string;
};

type PriceListItem = {
  id: string;
  productId?: string;
  productOptionId?: string;
  productName?: string;
  productCode?: string;
  optionCode: string;
  optionLabel?: string | null;
  description: string | null;
  category?: string | null;
  sortOrder: number;
  customerPrice: string;
  subcontractorPrice: string;
  discountAmount: string;
  discountEndsAt: string | null;
  effectiveCustomerPrice: string;
  isActive: boolean;
  type?: string;
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
  specialOptions: PriceListItem[];
};

function isReturnRow(
  item: Pick<
    EditableRow,
    "category" | "optionCode" | "optionLabel" | "description"
  >,
) {
  return isReturnOption(item.category, item.optionCode);
}

function isXtraRow(
  item: Pick<
    EditableRow,
    "category" | "optionCode" | "optionLabel" | "description"
  >,
) {
  return isXtraOption(item.category, item.optionCode);
}

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

      const combinedRows: EditableRow[] = [
        ...(data.priceList.items ?? []),
        ...(data.priceList.specialOptions ?? []),
      ];

      setRows(combinedRows);

      const originals = combinedRows.reduce(
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

  function updateProductRows(productId: string, patch: Partial<EditableRow>) {
    setRows((current) =>
      current.map((row) =>
        row.productId != null && row.productId === productId
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

    const isSpecialRow = isReturnRow(row) || isXtraRow(row);

    return (
      (!isSpecialRow && row.productName !== original.productName) ||
      row.customerPrice !== original.customerPrice ||
      row.subcontractorPrice !== original.subcontractorPrice ||
      row.isActive !== original.isActive ||
      row.optionCode !== original.optionCode ||
      (row.description ?? "") !== (original.description ?? "") ||
      (row.discountAmount ?? "") !== (original.discountAmount ?? "") ||
      (row.discountEndsAt ?? "") !== (original.discountEndsAt ?? "")
    );
  }

  async function saveRow(itemId: string) {
    const row = rows.find((item) => item.id === itemId);
    if (!row) return;

    const isReturn = isReturnRow(row);
    const isXtra = isXtraRow(row);
    const isSpecialRow = isReturn || isXtra;

    const url = isSpecialRow
      ? `/api/products/pricelists/special-options/${itemId}`
      : `/api/products/pricelists/items/${itemId}/full`;

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

    const body = {
      customerPrice: row.customerPrice,
      subcontractorPrice: row.subcontractorPrice,
      isActive: row.isActive,
      optionCode: row.optionCode,
      description: row.description,
      discountAmount: row.discountAmount,
      discountEndsAt: row.discountEndsAt,
      category: isReturn
        ? OPTION_CATEGORIES.RETURN
        : isXtra
          ? OPTION_CATEGORIES.XTRA
          : row.category,
      ...(isSpecialRow ? {} : { productName: row.productName }),
    };

    try {
      updateRow(itemId, { saving: true, error: null, saved: false });

      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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

  async function addOption(productId: string) {
    if (!priceList) return;

    const res = await fetch(
      `/api/products/pricelists/${priceList.id}/products/${productId}/options`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label: "Option",
          optionCode: "",
          category: "install",
          description: "",
        }),
      },
    );

    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert("Failed to create option");
      return;
    }

    const newItem = data.item;

    setRows((prev) => [...prev, newItem]);

    setOriginalRows((prev) => ({
      ...prev,
      [newItem.id]: newItem,
    }));
  }
  async function addSpecialOption(type: "return" | "xtra") {
    if (!priceList) return;

    const res = await fetch(
      `/api/products/pricelists/${priceList.id}/special-options`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type }),
      },
    );

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok || !data?.ok) {
      alert(data?.reason ?? `Failed to create ${type} option`);
      return;
    }

    const newItem: EditableRow = {
      ...data.item,
      category:
        data.item.type === "return"
          ? OPTION_CATEGORIES.RETURN
          : data.item.type === "xtra"
            ? OPTION_CATEGORIES.XTRA
            : (data.item.category ?? null),
      productId: undefined,
      productOptionId: undefined,
      productName: undefined,
      productCode: undefined,
      optionLabel: data.item.label ?? null,
    };

    setRows((prev) => [...prev, newItem]);

    setOriginalRows((prev) => ({
      ...prev,
      [newItem.id]: newItem,
    }));
  }
  async function deleteRow(itemId: string) {
    const confirmed = window.confirm("Delete this option?");
    if (!confirmed) return;

    try {
      const item = rows.find((row) => row.id === itemId);
      if (!item) return;

      const isSpecialRow = isReturnRow(item) || isXtraRow(item);

      const url = isSpecialRow
        ? `/api/products/pricelists/special-options/${itemId}`
        : `/api/products/pricelists/items/${itemId}`;

      const res = await fetch(url, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.reason ?? "Failed to delete row");
        return;
      }

      setRows((current) => current.filter((item) => item.id !== itemId));

      setOriginalRows((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    } catch {
      alert("Something went wrong while deleting");
    }
  }

  async function addProduct() {
    if (!priceList) return;

    const res = await fetch(
      `/api/products/pricelists/${priceList.id}/products`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert("Failed to create product");
      return;
    }

    const newItem = data.item;

    setRows((prev) => [...prev, newItem]);

    setOriginalRows((prev) => ({
      ...prev,
      [newItem.id]: newItem,
    }));
  }

  const normalRows = useMemo(
    () => rows.filter((row) => !isReturnRow(row) && !isXtraRow(row)),
    [rows],
  );

  const returnRows = useMemo(
    () => rows.filter((row) => isReturnRow(row) && !isXtraRow(row)),
    [rows],
  );

  const xtraRows = useMemo(() => rows.filter((row) => isXtraRow(row)), [rows]);

const groupedProducts = useMemo(() => {
  return Object.values(
    normalRows.reduce(
      (acc, item) => {
        if (!item.productId) return acc;

        const key = item.productId;

        if (!acc[key]) {
          acc[key] = {
            productId: item.productId,
            productName: item.productName ?? "",
            productCode: item.productCode ?? "",
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
}, [normalRows]);

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

        <div className="lg:pl-[50] lg:pr-[200] space-y-12">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-logoblue">
                Product Options
              </h2>
              <button onClick={addProduct} className="customButtonEnabled">
                Add Product
              </button>
            </div>

            <div className="w-full overflow-x-auto lg:overflow-x-visible [-webkit-overflow-scrolling:touch]">
              <table className="w-full table-fixed border border-black/10">
                <thead className="bg-gray-100">
                  <tr className="text-left">
                    <th className="w-64 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Product
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Option Code
                    </th>
                    <th className="w-60 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Description
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Category
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
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Active
                    </th>
                    <th className="w-40 px-4 py-4 border bg-white text-logoBlue font-semibold text-center">
                      Update
                    </th>
                  </tr>
                </thead>

                {groupedProducts.map((group) => (
                  <tbody key={group.productId} className="group">
                    {group.items.map((item, index) => {
                      const discountActive =
                        item.discountAmount &&
                        item.discountEndsAt &&
                        new Date(item.discountEndsAt) > new Date();

                      return (
                        <tr
                          key={item.id}
                          className="group relative align-middle border-b-2 border-logoblue/50"
                        >
                          {index === 0 && (
                            <td
                              rowSpan={group.items.length}
                              className="border-r border-logoblue/50 font-medium align-center relative before:content-[''] before:absolute before:top-0 before:bottom-0 before:left-[-100] before:w-[200] before:bg-transparent"
                            >
                              <div className="flex flex-col gap-3 p-3">
                                <input
                                  className="w-full text-center py-1 px-2 rounded focus:outline-none hover:bg-black/5"
                                  value={group.productName}
                                  onChange={(e) =>
                                    updateProductRows(group.productId, {
                                      productName: e.target.value,
                                    })
                                  }
                                />

                                <button
                                  type="button"
                                  title="Add option"
                                  onClick={() => addOption(group.productId)}
                                  className="absolute -left-11 top-1/2 -translate-y-1/2 w-6 h-6 text-sm rounded-full bg-white border-2 border-logoblue font-bold opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:text-white hover:bg-logoblue cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                          )}

                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.optionCode ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  optionCode: e.target.value
                                    .toUpperCase()
                                    .replace(/\s/g, ""),
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.description ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  description: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <div className="flex items-center justify-center">
                              <p>Install</p>
                            </div>
                          </td>

                          <td>
                            <div className="flex items-center">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none text-center"
                                value={item.customerPrice ?? ""}
                                onChange={(e) =>
                                  updateRow(item.id, {
                                    customerPrice: e.target.value,
                                  })
                                }
                              />
                              {discountActive && (
                                <div className="text-sm mt-1 flex gap-2 items-center">
                                  <span className="text-red-600 font-semibold">
                                    {item.effectiveCustomerPrice}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.subcontractorPrice ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  subcontractorPrice: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="text"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountAmount ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountAmount: e.target.value,
                                })
                              }
                              placeholder='"%" or number'
                            />
                          </td>

                          <td>
                            <input
                              type="date"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountEndsAt ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountEndsAt: e.target.value || null,
                                })
                              }
                            />
                          </td>

                          <td>
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
                          </td>

                          <td className="align-middle">
                            <div className="flex justify-between items-center w-full">
                              <div className="flex items-center gap-2 relative">
                                {isDirty(item) && (
                                  <button
                                    type="button"
                                    onClick={() => saveRow(item.id)}
                                    disabled={item.saving}
                                    className="customButtonEnabled"
                                  >
                                    {item.saving ? "Saving..." : "Update"}
                                  </button>
                                )}

                                {!isDirty(item) && item.saved && (
                                  <span className="text-sm text-green-600 font-medium">
                                    Saved
                                  </span>
                                )}

                                {!isDirty(item) && item.error && (
                                  <span className="text-sm text-red-600 font-medium">
                                    {item.error}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => deleteRow(item.id)}
                                  className="px-3 py-1 rounded-md border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </section>

          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-logoblue">
                Return Options
              </h2>
              <button
                type="button"
                onClick={() => addSpecialOption("return")}
                className="customButtonEnabled"
              >
                Add Option
              </button>
            </div>

            <div className="w-full overflow-x-auto lg:overflow-x-visible [-webkit-overflow-scrolling:touch]">
              <table className="w-full table-fixed border border-black/10">
                <thead className="bg-gray-100">
                  <tr className="text-left">
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Option Code
                    </th>
                    <th className="w-60 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Description
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Category
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
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Active
                    </th>
                    <th className="w-40 px-4 py-4 border bg-white text-logoBlue font-semibold text-center">
                      Update
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {returnRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-6 text-center text-black/50"
                      >
                        No return options found.
                      </td>
                    </tr>
                  ) : (
                    returnRows.map((item) => {
                      const discountActive =
                        item.discountAmount &&
                        item.discountEndsAt &&
                        new Date(item.discountEndsAt) > new Date();

                      return (
                        <tr
                          key={item.id}
                          className="group relative align-middle border-b border-logoblue/20"
                        >
                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.optionCode ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  optionCode: e.target.value
                                    .toUpperCase()
                                    .replace(/\s/g, ""),
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.description ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  description: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <div className="flex items-center justify-center">
                              <p>{OPTION_CATEGORIES.RETURN}</p>
                            </div>
                          </td>

                          <td>
                            <div className="flex items-center">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none text-center"
                                value={item.customerPrice ?? ""}
                                onChange={(e) =>
                                  updateRow(item.id, {
                                    customerPrice: e.target.value,
                                  })
                                }
                              />
                              {discountActive && (
                                <div className="text-sm mt-1 flex gap-2 items-center">
                                  <span className="text-red-600 font-semibold">
                                    {item.effectiveCustomerPrice}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.subcontractorPrice ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  subcontractorPrice: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="text"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountAmount ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountAmount: e.target.value,
                                })
                              }
                              placeholder='"%" or number'
                            />
                          </td>

                          <td>
                            <input
                              type="date"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountEndsAt ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountEndsAt: e.target.value || null,
                                })
                              }
                            />
                          </td>

                          <td>
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
                          </td>

                          <td className="align-middle">
                            <div className="flex justify-between items-center w-full">
                              <div className="flex items-center gap-2 relative">
                                {isDirty(item) && (
                                  <button
                                    type="button"
                                    onClick={() => saveRow(item.id)}
                                    disabled={item.saving}
                                    className="customButtonEnabled"
                                  >
                                    {item.saving ? "Saving..." : "Update"}
                                  </button>
                                )}

                                {!isDirty(item) && item.saved && (
                                  <span className="text-sm text-green-600 font-medium">
                                    Saved
                                  </span>
                                )}

                                {!isDirty(item) && item.error && (
                                  <span className="text-sm text-red-600 font-medium">
                                    {item.error}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => deleteRow(item.id)}
                                  className="px-3 py-1 rounded-md border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-logoblue">XTRA Options</h2>
              <button
                type="button"
                onClick={() => addSpecialOption("xtra")}
                className="customButtonEnabled"
              >
                Add Option
              </button>
            </div>

            <div className="w-full overflow-x-auto lg:overflow-x-visible [-webkit-overflow-scrolling:touch]">
              <table className="w-full table-fixed border border-black/10">
                <thead className="bg-gray-100">
                  <tr className="text-left">
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Option Code
                    </th>
                    <th className="w-60 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Description
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Category
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
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Active
                    </th>
                    <th className="w-40 px-4 py-4 border bg-white text-logoBlue font-semibold text-center">
                      Update
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {xtraRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-6 text-center text-black/50"
                      >
                        No XTRA options found.
                      </td>
                    </tr>
                  ) : (
                    xtraRows.map((item) => {
                      const discountActive =
                        item.discountAmount &&
                        item.discountEndsAt &&
                        new Date(item.discountEndsAt) > new Date();

                      return (
                        <tr
                          key={item.id}
                          className="group relative align-middle border-b border-logoblue/20"
                        >
                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.optionCode ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  optionCode: e.target.value
                                    .toUpperCase()
                                    .replace(/\s/g, ""),
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.description ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  description: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <div className="flex items-center justify-center">
                              <p>{OPTION_CODES.XTRA}</p>
                            </div>
                          </td>

                          <td>
                            <div className="flex items-center">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none text-center"
                                value={item.customerPrice ?? ""}
                                onChange={(e) =>
                                  updateRow(item.id, {
                                    customerPrice: e.target.value,
                                  })
                                }
                              />
                              {discountActive && (
                                <div className="text-sm mt-1 flex gap-2 items-center">
                                  <span className="text-red-600 font-semibold">
                                    {item.effectiveCustomerPrice}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.subcontractorPrice ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  subcontractorPrice: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="text"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountAmount ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountAmount: e.target.value,
                                })
                              }
                              placeholder='"%" or number'
                            />
                          </td>

                          <td>
                            <input
                              type="date"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountEndsAt ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountEndsAt: e.target.value || null,
                                })
                              }
                            />
                          </td>

                          <td>
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
                          </td>

                          <td className="align-middle">
                            <div className="flex justify-between items-center w-full">
                              <div className="flex items-center gap-2 relative">
                                {isDirty(item) && (
                                  <button
                                    type="button"
                                    onClick={() => saveRow(item.id)}
                                    disabled={item.saving}
                                    className="customButtonEnabled"
                                  >
                                    {item.saving ? "Saving..." : "Update"}
                                  </button>
                                )}

                                {!isDirty(item) && item.saved && (
                                  <span className="text-sm text-green-600 font-medium">
                                    Saved
                                  </span>
                                )}

                                {!isDirty(item) && item.error && (
                                  <span className="text-sm text-red-600 font-medium">
                                    {item.error}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => deleteRow(item.id)}
                                  className="px-3 py-1 rounded-md border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
