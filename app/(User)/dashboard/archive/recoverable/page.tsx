"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";

type RecoverableFolderRow = {
  id: string;
  parentFolderId: string | null;
  name: string;
  deletedAt: string;
};

type RecoverableItemRow = {
  id: string;
  folderId: string;
  name: string;
  deletedAt: string;
};

export default function ArchiveRecoverablePage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const archiveAccess = currentUser ? getModuleAccess(currentUser, "ARCHIVE") : { enabled: true, level: "ADMIN" as const };
  const hasAccess = archiveAccess.enabled && archiveAccess.level === "ADMIN";

  const [folders, setFolders] = useState<RecoverableFolderRow[]>([]);
  const [items, setItems] = useState<RecoverableItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  async function loadRecoverable() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/archive/recoverable", {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to load deleted content");
        return;
      }

      setFolders(data.folders ?? []);
      setItems(data.items ?? []);
    } catch {
      setError("Failed to load deleted content");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;
    void loadRecoverable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, hasAccess]);

  async function handleRestoreFolder(folderId: string) {
    try {
      setRestoringId(folderId);
      setActionError("");

      const res = await fetch(`/api/archive/folders/${folderId}/restore`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setActionError(data?.reason || "Failed to restore folder");
        return;
      }

      setFolders((prev) => prev.filter((f) => f.id !== folderId));
    } catch {
      setActionError("Failed to restore folder");
    } finally {
      setRestoringId(null);
    }
  }

  async function handleRestoreItem(itemId: string) {
    try {
      setRestoringId(itemId);
      setActionError("");

      const res = await fetch(`/api/archive/items/${itemId}/restore`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setActionError(data?.reason || "Failed to restore item");
        return;
      }

      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      setActionError("Failed to restore item");
    } finally {
      setRestoringId(null);
    }
  }

  if (currentUser && !hasAccess) {
    return (
      <div className="w-full">
        <p className="text-textColorThird">
          {locale === "nb" ? "Du har ikke tilgang til arkivet." : "You do not have access to the archive."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Link href="/dashboard/archive" className="mb-4 inline-block text-sm text-textColorThird hover:underline">
        {locale === "nb" ? "← Tilbake til arkivet" : "← Back to archive"}
      </Link>

      <div className="mb-8">
        <h1 className="whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
          {locale === "nb" ? "Slettede elementer" : "Deleted content"}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-textColorThird">
          {locale === "nb"
            ? "Gjenopprett slettede mapper og elementer."
            : "Restore deleted folders and items."}
        </p>
      </div>

      {(error || actionError) && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {error || actionError}
        </div>
      )}

      {loading ? (
        <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
          {locale === "nb" ? "Laster..." : "Loading..."}
        </div>
      ) : (
        <>
          <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Mapper" : "Folders"}</h2>
          <div className="customContainer mb-6 divide-y divide-lineSecondary">
            {folders.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-textColorThird">
                {locale === "nb" ? "Ingen slettede mapper" : "No deleted folders"}
              </div>
            ) : (
              folders.map((folder) => (
                <div key={folder.id} className="flex items-center justify-between gap-4 py-3 px-2">
                  <div>
                    <div className="font-medium text-textcolor">{folder.name}</div>
                    <div className="text-sm text-textColorThird">
                      {new Date(folder.deletedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="customButtonDefault shrink-0"
                    onClick={() => void handleRestoreFolder(folder.id)}
                    disabled={restoringId === folder.id}
                  >
                    {locale === "nb" ? "Gjenopprett" : "Restore"}
                  </button>
                </div>
              ))
            )}
          </div>

          <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Elementer" : "Items"}</h2>
          <div className="customContainer divide-y divide-lineSecondary">
            {items.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-textColorThird">
                {locale === "nb" ? "Ingen slettede elementer" : "No deleted items"}
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-3 px-2">
                  <div>
                    <div className="font-medium text-textcolor">{item.name}</div>
                    <div className="text-sm text-textColorThird">
                      {new Date(item.deletedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="customButtonDefault shrink-0"
                    onClick={() => void handleRestoreItem(item.id)}
                    disabled={restoringId === item.id}
                  >
                    {locale === "nb" ? "Gjenopprett" : "Restore"}
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
