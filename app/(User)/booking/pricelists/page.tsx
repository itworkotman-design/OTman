"use client";

import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { bookingText } from "@/lib/booking/bookingUiText";
import { useUserLanguage } from "@/lib/users/language";
import { hasFullAccess, isSubcontractorAccess } from "@/lib/users/access";

type PriceListSummary = {
  id: string;
  name: string;
  code: string;
};

type PriceListItem = {
  id: string;
  productId?: string;
  productName?: string;
  optionCode?: string | null;
  optionLabel?: string | null;
  description?: string | null;
  effectiveCustomerPrice: string;
  subcontractorPrice: string;
  type?: string;
};

type PriceListData = {
  id: string;
  name: string;
  items: PriceListItem[];
  specialOptions: PriceListItem[];
};

function isReturnRow(item: PriceListItem) {
  return !item.productId && item.type === "return";
}

function isXtraRow(item: PriceListItem) {
  return !item.productId && item.type === "xtra";
}

function isExtraServiceRow(item: PriceListItem) {
  return !item.productId && item.type === "extra_service";
}

export default function UserPriceListsPage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const isSubcontractor = currentUser ? isSubcontractorAccess(currentUser.permissions) : false;
  const [priceLists, setPriceLists] = useState<PriceListSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [priceList, setPriceList] = useState<PriceListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/products/pricelists?mine=true", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.reason ?? "Failed to load price lists");
          return;
        }
        const next: PriceListSummary[] = data.priceLists ?? [];
        setPriceLists(next);
        setSelectedId(next[0]?.id ?? null);
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activeSummary = useMemo(() => {
    return priceLists.find((pl) => pl.id === selectedId) ?? priceLists[0] ?? null;
  }, [priceLists, selectedId]);

  useEffect(() => {
    if (!activeSummary) {
      setPriceList(null);
      return;
    }

    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/products/pricelists/${activeSummary!.id}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.reason ?? "Failed to load price list");
          setPriceList(null);
          return;
        }
        setPriceList(data.priceList);
      } catch {
        setError("Something went wrong");
        setPriceList(null);
      } finally {
        setLoading(false);
      }
    }

    void loadDetail();
  }, [activeSummary]);

  const normalRows = useMemo(
    () => (priceList?.items ?? []).filter(
      (row) => !isReturnRow(row) && !isXtraRow(row) && !isExtraServiceRow(row)
    ),
    [priceList],
  );

  const returnRows = useMemo(
    () => (priceList?.specialOptions ?? []).filter((row) => isReturnRow(row)),
    [priceList],
  );

  const xtraRows = useMemo(
    () => (priceList?.specialOptions ?? []).filter((row) => isXtraRow(row)),
    [priceList],
  );

  const extraServiceRows = useMemo(
    () => (priceList?.specialOptions ?? []).filter((row) => isExtraServiceRow(row)),
    [priceList],
  );

  const groupedProducts = useMemo(() => {
    return Object.values(
      normalRows.reduce(
        (acc, item) => {
          if (!item.productId) return acc;
          if (!acc[item.productId]) {
            acc[item.productId] = {
              productId: item.productId,
              productName: item.productName ?? "",
              items: [],
            };
          }
          acc[item.productId].items.push(item);
          return acc;
        },
        {} as Record<string, { productId: string; productName: string; items: PriceListItem[] }>,
      ),
    );
  }, [normalRows]);

  function handleDownloadPdf() {
    if (!priceList) return;

    const t = (text: string) => bookingText(locale, text);

    const rowsHtml = groupedProducts
      .map((group) =>
        group.items
          .map(
            (item, index) => `
      <tr>
        ${index === 0 ? `<td rowspan="${group.items.length}" class="product-cell">${group.productName}</td>` : ""}
        <td>${item.optionCode ?? "—"}</td>
        <td>${item.description ?? item.optionLabel ?? "—"}</td>
        <td class="price-cell">${isSubcontractor ? item.subcontractorPrice : item.effectiveCustomerPrice}</td>
      </tr>`,
          )
          .join(""),
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${priceList.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #111; }
    h1 { color: #1e3a6e; font-size: 20px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #1e3a6e; color: #fff; padding: 8px 14px; font-size: 13px; text-align: center; }
    tbody td { padding: 7px 14px; border: 1px solid #ddd; font-size: 13px; }
    .product-cell { font-weight: 600; text-align: center; vertical-align: middle; }
    .price-cell { text-align: center; font-weight: 700; color: #1e3a6e; }
    tr:nth-child(even) td { background: #f5f8ff; }
  </style>
</head>
<body>
  <h1>${priceList.name}</h1>
  <table>
    <thead>
      <tr>
        <th>${t("Product")}</th>
        <th>${t("Option Code")}</th>
        <th>${t("Label")}</th>
        <th>${t("Price (NOK)")}</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 250);
  }

  async function handleExportExcel() {
    if (!priceList) return;

    const t = (text: string) => bookingText(locale, text);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(priceList.name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    worksheet.columns = [
      { header: t("Product"), key: "product", width: 28 },
      { header: t("Option Code"), key: "optionCode", width: 18 },
      { header: t("Label"), key: "label", width: 36 },
      { header: t("Price (NOK)"), key: "price", width: 16 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A6E" } };
    headerRow.alignment = { horizontal: "center" };

    for (const group of groupedProducts) {
      for (const item of group.items) {
        worksheet.addRow({
          product: group.productName,
          optionCode: item.optionCode ?? "—",
          label: item.description ?? item.optionLabel ?? "—",
          price: isSubcontractor ? item.subcontractorPrice : item.effectiveCustomerPrice,
        });
      }
    }

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.getCell("price").alignment = { horizontal: "center" };
      if (rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F8FF" } };
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${priceList.name}.xlsx`);
  }

  if (!currentUser) return null;

  return (
    <div className="mx-auto max-w-[1200] py-6">
      <h1 className="mb-8 text-2xl font-semibold text-logoblue lg:text-4xl">{bookingText(locale, "Price Lists")}</h1>

      {loading && <p className="text-textColorThird">{bookingText(locale, "Loading...")}</p>}

      {!loading && error && <p className="text-red-600">{bookingText(locale, error)}</p>}

      {!loading && !error && priceLists.length === 0 && (
        <p className="text-textColorThird">{bookingText(locale, "No price lists assigned to your account.")}</p>
      )}

      {priceLists.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {priceLists.map((pl) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => setSelectedId(pl.id)}
              className={`customButtonDefault ${activeSummary?.id === pl.id ? "customButtonEnabled" : "customButtonDefault"}`}
            >
              {pl.name}
            </button>
          ))}
        </div>
      )}

      {priceList && (
        <>
          <div className="space-y-10">
            {groupedProducts.length > 0 && (
              <section>
                <h2 className="mb-4 text-xl font-bold text-logoblue">{bookingText(locale, "Product Options")}</h2>
                <div className="w-full overflow-x-auto">
                  <table className="min-w-full border border-black/10">
                    <thead>
                      <tr>
                        <th className="w-56 border bg-logoblue px-4 py-3 text-center font-semibold text-white">{bookingText(locale, "Product")}</th>
                        <th className="w-36 border bg-logoblue px-4 py-3 text-center font-semibold text-white">{bookingText(locale, "Option Code")}</th>
                        <th className="w-72 border bg-logoblue px-4 py-3 text-center font-semibold text-white">{bookingText(locale, "Label")}</th>
                        <th className="w-36 border bg-logoblue px-4 py-3 text-center font-semibold text-white">{bookingText(locale, "Price (NOK)")}</th>
                      </tr>
                    </thead>
                    {groupedProducts.map((group) => (
                      <tbody key={group.productId}>
                        {group.items.map((item, index) => (
                          <tr key={item.id} className="group align-middle border-b-2 border-logoblue/30">
                            {index === 0 && (
                              <td rowSpan={group.items.length} className="border-r border-logoblue/30 px-4 py-3 text-center font-medium">
                                {group.productName}
                              </td>
                            )}
                            <td className="border-r border-logoblue/20 px-4 py-3 text-left text-sm font-mono text-textColorSecond group-hover:bg-black/10 group-hover:text-textcolor">{item.optionCode || "—"}</td>
                            <td className="border-r border-logoblue/20 px-4 py-3 text-left text-sm text-textColorSecond group-hover:bg-black/10 group-hover:text-textcolor">
                              {item.description || item.optionLabel || "—"}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-logoblue group-hover:bg-black/10">{isSubcontractor ? item.subcontractorPrice : item.effectiveCustomerPrice}</td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                  </table>
                </div>
              </section>
            )}
          </div>

          {!hasFullAccess(currentUser.role) && (
            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="customButtonDefault customButtonEnabled flex items-center gap-2"
              >
                {bookingText(locale, "Download PDF")}
              </button>
              <button
                type="button"
                onClick={() => void handleExportExcel()}
                className="customButtonDefault customButtonEnabled flex items-center gap-2"
              >
                {bookingText(locale, "Export to Excel")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
