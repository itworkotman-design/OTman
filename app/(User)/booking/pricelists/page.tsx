"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { bookingText } from "@/lib/booking/bookingUiText";
import { useUserLanguage } from "@/lib/users/language";
import { isSubcontractorAccess } from "@/lib/users/access";

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
      )}
    </div>
  );
}
