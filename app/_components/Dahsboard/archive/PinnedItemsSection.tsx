"use client";

import { useEffect, useState } from "react";
import { ItemPill } from "./ItemPill";
import { codeBadgeWidthCh, codeToUrlPath } from "./types";
import type { ArchiveItemSummary } from "./types";

type PinnedItemsResponse = {
  ok?: boolean;
  items?: ArchiveItemSummary[];
  reason?: string;
};

// Real per-user pinning (0.2.0 delivery — pinItem/unpinItem/listPinnedItems).
// Unlike PinnedFoldersSection, this is fully self-contained: the archive
// root page has no "main list of all items" elsewhere on the page whose star
// state would need to stay in sync with this one, so a pin toggle here just
// reloads this component's own list — no refreshKey/onPinChanged threaded
// in from the parent page. `canEdit` is threaded through to ItemPill's
// PillHoverActions, which gates the unpin star on it — pinning is
// admin-only, so a non-admin viewer's own pinned list is always empty
// anyway (they can never create a pin), but this keeps the gate explicit.
export function PinnedItemsSection({ locale, canEdit }: { locale: string; canEdit: boolean }) {
  const [items, setItems] = useState<ArchiveItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadPinnedItems() {
      setLoading(true);
      try {
        const res = await fetch("/api/archive/pinned-items", { method: "GET", credentials: "include", cache: "no-store" });
        const data = (await res.json().catch(() => null)) as PinnedItemsResponse | null;
        if (!cancelled) setItems(data?.ok ? (data.items ?? []) : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPinnedItems();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (loading) return null;
  if (items.length === 0) return null;

  const codeWidthCh = codeBadgeWidthCh(items.map((i) => i.code), 5);

  return (
    <section className="my-6">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[2rem] font-bold text-logoblue">{locale === "nb" ? "Festede elementer" : "Pinned items"}</h2>
      </div>
      <div className="divide-y divide-lineSecondary border-y border-lineSecondary">
        {items.map((item) => (
          <ItemPill
            key={item.id}
            item={item}
            href={`/dashboard/archive/${codeToUrlPath(item.code)}`}
            locale={locale}
            canEdit={canEdit}
            showFavorite
            isPinned
            onPinChanged={() => setReloadKey((key) => key + 1)}
            codeWidthCh={codeWidthCh}
          />
        ))}
      </div>
    </section>
  );
}
