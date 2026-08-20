"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { EntityPill, type PillField } from "@/app/_components/Dahsboard/archive/EntityPill";
import { codeBadgeWidthCh, formatLastModified } from "@/app/_components/Dahsboard/archive/types";
import type { ArchiveFolderSummary, ArchiveItemSummary } from "@/app/_components/Dahsboard/archive/types";

// Google-Drive-style "Shared with me": folders/items the current user has a
// DIRECT permission grant on, regardless of whether they can also browse
// down to them from the archive root — see lib/docArchive/sharedWithMe.ts
// and the plan behind this page. Always rendered in viewer mode (no
// rename/delete/settings actions) even for Archive-Admins, since those
// actions' links are code-path-based and would break for a folder/item this
// viewer can't necessarily reach any other way — see FolderView's
// ArchiveLinkMode comment.
export default function SharedWithMePage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const archiveAccess = currentUser ? getModuleAccess(currentUser, "ARCHIVE") : { enabled: true, level: "ADMIN" as const };
  const hasAccess = archiveAccess.enabled;

  const [folders, setFolders] = useState<ArchiveFolderSummary[]>([]);
  const [items, setItems] = useState<ArchiveItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/archive/shared-with-me", { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (cancelled) return;

        if (!res.ok || !data?.ok) {
          setError(data?.reason || "Failed to load shared items");
          return;
        }

        setFolders(data.folders ?? []);
        setItems(data.items ?? []);
      } catch {
        if (!cancelled) setError("Failed to load shared items");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, hasAccess]);

  if (currentUser && !hasAccess) {
    return (
      <div className="w-full">
        <p className="text-textColorThird">
          {locale === "nb" ? "Du har ikke tilgang til arkivet." : "You do not have access to the archive."}
        </p>
      </div>
    );
  }

  const activeFolders = folders.filter((folder) => folder.status === "active");
  const activeItems = items.filter((item) => item.status === "active");
  const codeWidthCh = codeBadgeWidthCh([...activeFolders.map((f) => f.code), ...activeItems.map((i) => i.code)]);

  return (
    <div className="w-full">
      <h1 className="mb-8 text-center text-2xl font-semibold text-logoblue lg:text-4xl">
        {locale === "nb" ? "Delt med deg" : "Shared with you"}
      </h1>

      {error && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
          {locale === "nb" ? "Laster..." : "Loading..."}
        </div>
      ) : activeFolders.length === 0 && activeItems.length === 0 ? (
        <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
          {locale === "nb" ? "Ingenting er delt med deg ennå" : "Nothing has been shared with you yet"}
        </div>
      ) : (
        <div className="divide-y divide-lineSecondary border-y border-lineSecondary">
          {activeFolders.map((folder) => (
            <EntityPill
              key={folder.id}
              kind="folder"
              id={folder.id}
              name={folder.name}
              description={folder.description}
              status={folder.status}
              conditionFlags={folder}
              href={`/dashboard/archive/shared/folder/${folder.id}`}
              locale={locale}
              code={folder.code}
              mode="viewer"
              fields={[{ key: "updated", value: formatLastModified(folder.updatedAt) }] satisfies PillField[]}
              codeWidthCh={codeWidthCh}
            />
          ))}
          {activeItems.map((item) => (
            <EntityPill
              key={item.id}
              kind="item"
              id={item.id}
              name={item.name}
              description={item.description}
              status={item.status}
              conditionFlags={item}
              href={`/dashboard/archive/shared/item/${item.id}`}
              locale={locale}
              code={item.code}
              mode="viewer"
              fields={[{ key: "updated", value: formatLastModified(item.updatedAt) }] satisfies PillField[]}
              codeWidthCh={codeWidthCh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
