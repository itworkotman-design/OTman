"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { ArchiveSearchBar } from "@/app/_components/Dahsboard/archive/ArchiveSearchBar";
import { FolderPill } from "@/app/_components/Dahsboard/archive/FolderPill";
import { PinnedFoldersSection } from "@/app/_components/Dahsboard/archive/PinnedFoldersSection";
import { ArchiveNotificationsPanel } from "@/app/_components/Dahsboard/archive/ArchiveNotificationsPanel";
import { ArchiveRootSettingsModal } from "@/app/_components/Dahsboard/archive/ArchiveRootSettingsModal";
import { codeToUrlPath } from "@/app/_components/Dahsboard/archive/types";
import type { ArchiveFolderSummary } from "@/app/_components/Dahsboard/archive/types";

type ArchiveFolderRow = ArchiveFolderSummary & {
  createdAt: string;
};

type FoldersApiResponse = {
  ok?: boolean;
  folders?: ArchiveFolderRow[];
  reason?: string;
};

// Matches the otman-archive prototype's root page (app/page.tsx) layout:
// centered title + Settings button, pinned section, then a two-column
// name-filter/folder-list + reminders layout. No Search/Roles/View
// deleted/UI lab links here — those pages still exist, just unlinked from
// this page per explicit instruction.
export default function ArchivePage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const archiveAccess = currentUser ? getModuleAccess(currentUser, "ARCHIVE") : { enabled: true, level: "ADMIN" as const };
  const hasAccess = archiveAccess.enabled;
  const isArchiveAdmin = archiveAccess.level === "ADMIN";

  const [folders, setFolders] = useState<ArchiveFolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadFolders() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/archive/folders", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as FoldersApiResponse | null;

      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to load folders");
        setFolders([]);
        return;
      }

      setFolders(data.folders ?? []);
    } catch {
      setError("Failed to load folders");
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;
    void loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, hasAccess]);

  async function handleCreateFolder(sectionId: string, name: string, description: string | null) {
    const res = await fetch("/api/archive/folders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, sectionId }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      return { ok: false, reason: data?.reason || "Failed to create folder" };
    }

    await loadFolders();
    return { ok: true };
  }

  async function handleArchiveFolder(folderId: string) {
    const current = folders.find((f) => f.id === folderId);
    const nextStatus = current?.status === "archived" ? "active" : "archived";

    const res = await fetch(`/api/archive/folders/${folderId}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.ok) {
      setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, status: nextStatus } : f)));
    }
  }

  async function handleDeleteFolder(folderId: string) {
    const res = await fetch(`/api/archive/folders/${folderId}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.ok) {
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
    }
  }

  const visibleFolders = useMemo(() => folders.filter((folder) => folder.status === "active"), [folders]);

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
      <section className="mb-2 flex w-full flex-col items-center gap-3">
        <h1 className="text-[2.5rem] font-bold text-logoblue">{locale === "nb" ? "Arkiv" : "Archive"}</h1>
        {isArchiveAdmin && (
          <ArchiveRootSettingsModal
            folders={folders}
            locale={locale}
            onCreateFolder={handleCreateFolder}
            onArchiveFolder={handleArchiveFolder}
            onDeleteFolder={handleDeleteFolder}
            onFoldersChanged={loadFolders}
          />
        )}
        <div className="w-full max-w-[400]">
          <ArchiveSearchBar
            scopeFolderId={null}
            locale={locale}
            placeholder={locale === "nb" ? "Søk i arkivet" : "Search in this archive"}
          />
        </div>
      </section>

      <PinnedFoldersSection locale={locale} />

      <section className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-4 flex h-10 grow items-end justify-end gap-4 font-semibold text-textColorThird">
            <div className="w-full max-w-[140] text-center">
              <p>{locale === "nb" ? "Elementer" : "Entries"}</p>
            </div>
            <div className="w-full max-w-[140] text-center">
              <p>{locale === "nb" ? "Brukere" : "Users"}</p>
            </div>
            <div className="w-full max-w-[140] text-center">
              <p>{locale === "nb" ? "Sist endret" : "Updated"}</p>
            </div>
          </div>

          <div className="min-w-0 w-full overflow-x-auto">
            {loading ? (
              <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
                {locale === "nb" ? "Laster mapper..." : "Loading folders..."}
              </div>
            ) : error ? (
              <div className="customContainer flex items-center justify-center border-red-200! bg-red-50 py-10 text-sm font-medium text-red-600">
                {error}
              </div>
            ) : visibleFolders.length === 0 ? (
              <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
                {locale === "nb" ? "Ingen mapper funnet" : "No folders found"}
              </div>
            ) : (
              <div className="grid gap-6">
                {visibleFolders.map((folder) => (
                  <FolderPill
                    key={folder.id}
                    folder={folder}
                    href={`/dashboard/archive/${codeToUrlPath(folder.code)}`}
                    showDescription={false}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-4 h-10" />
          <ArchiveNotificationsPanel locale={locale} canRunNow={isArchiveAdmin} />
        </div>
      </section>
    </div>
  );
}
