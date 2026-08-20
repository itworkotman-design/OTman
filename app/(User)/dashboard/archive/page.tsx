"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { ArchiveSearchBar } from "@/app/_components/Dahsboard/archive/ArchiveSearchBar";
import { EntityPill, type PillField } from "@/app/_components/Dahsboard/archive/EntityPill";
import { PillActions } from "@/app/_components/Dahsboard/archive/PillActions";
import { PinnedFoldersSection } from "@/app/_components/Dahsboard/archive/PinnedFoldersSection";
import { ArchiveRootSettingsModal } from "@/app/_components/Dahsboard/archive/ArchiveRootSettingsModal";
import { codeBadgeWidthCh, codeToUrlPath, formatLastModified, groupBySection } from "@/app/_components/Dahsboard/archive/types";
import type { ArchiveFolderSummary, ArchiveSectionSummary } from "@/app/_components/Dahsboard/archive/types";

type ArchiveFolderRow = ArchiveFolderSummary & {
  createdAt: string;
};

type FoldersApiResponse = {
  ok?: boolean;
  folders?: ArchiveFolderRow[];
  reason?: string;
};

type SectionsApiResponse = {
  ok?: boolean;
  sections?: ArchiveSectionSummary[];
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
  const [sections, setSections] = useState<ArchiveSectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runningReminders, setRunningReminders] = useState(false);
  const [pinRefreshKey, setPinRefreshKey] = useState(0);

  function handlePinChanged() {
    setPinRefreshKey((key) => key + 1);
    void loadFolders();
  }

  async function loadFolders() {
    try {
      setLoading(true);
      setError("");

      const [res, sectionsRes] = await Promise.all([
        fetch("/api/archive/folders", { method: "GET", credentials: "include", cache: "no-store" }),
        fetch("/api/archive/sections", { method: "GET", credentials: "include", cache: "no-store" }),
      ]);
      const data = (await res.json().catch(() => null)) as FoldersApiResponse | null;
      const sectionsData = (await sectionsRes.json().catch(() => null)) as SectionsApiResponse | null;

      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to load folders");
        setFolders([]);
        return;
      }

      setFolders(data.folders ?? []);

      if (sectionsRes.ok && sectionsData?.ok) {
        setSections(sectionsData.sections ?? []);
      }
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
  }, [currentUser?.id, hasAccess]);

  async function handleCreateFolder(sectionId: string | null, name: string, description: string | null) {
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

  async function handleRunRemindersCron() {
    setRunningReminders(true);
    try {
      const res = await fetch("/api/archive/reminders/generate-now", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        alert(data?.reason || "Failed to run archive reminders cron");
        return;
      }

      alert(`Archive reminders cron ran. ${JSON.stringify(data)}`);
    } finally {
      setRunningReminders(false);
    }
  }

  const visibleFolders = useMemo(() => folders.filter((folder) => folder.status === "active"), [folders]);
  const codeWidthCh = useMemo(() => codeBadgeWidthCh(visibleFolders.map((f) => f.code), 5), [visibleFolders]);
  const sectionGroups = useMemo(
    () => groupBySection(visibleFolders, sections, locale),
    [visibleFolders, sections, locale],
  );

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
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-logoblue sm:text-[2.5rem]">{locale === "nb" ? "Arkiv" : "Archive"}</h1>
          {isArchiveAdmin && (
            <ArchiveRootSettingsModal
              folders={folders}
              locale={locale}
              onCreateFolder={handleCreateFolder}
              onFoldersChanged={loadFolders}
            />
          )}
          {process.env.NODE_ENV === "development" && isArchiveAdmin && (
            <button
              type="button"
              className="customButtonDefault text-xs"
              disabled={runningReminders}
              onClick={handleRunRemindersCron}
              title="Dev only: runs the archive-reminders cron job on demand"
            >
              {runningReminders ? "Running reminders cron..." : "Run reminders cron (dev)"}
            </button>
          )}
        </div>
        <div className="w-full max-w-[400]">
          <ArchiveSearchBar
            scopeFolderId={null}
            locale={locale}
            placeholder={locale === "nb" ? "Søk i arkivet" : "Search in this archive"}
          />
        </div>
        <Link href="/dashboard/archive/shared" className="text-sm text-logoblue hover:underline">
          {locale === "nb" ? "Delt med deg" : "Shared with you"}
        </Link>
      </section>

      {/* Mirrors EntityPill's own row shape (content div with the same
          gap-2 sm:gap-3 + px-2) so these labels land over the value columns
          they name instead of drifting as columns are hidden/shown. The
          trailing spacer only renders for admins, matching EntityPill only
          mounting PillActions when its mode is "admin" — for viewers
          there's no trailing box at all, so the header has none either. It's
          a real (invisible) PillActions rendered with the same props as the
          folder rows below, rather than a fixed width, so it tracks
          PillActions' own intrinsic width automatically as actions are
          added or removed instead of needing to be kept in sync by hand.
          Sits above Pinned folders/items since both sections share this
          same column layout, not just the grouped list below. */}
      <div className="mb-4 hidden h-10 items-end text-sm font-semibold text-textColorThird sm:flex">
        <div className="flex min-w-0 grow items-center justify-end gap-2 sm:gap-3 px-2">
          <div className="w-full max-w-[100] text-center">
            <p>{locale === "nb" ? "Elementer" : "Entries"}</p>
          </div>
          {isArchiveAdmin && (
            <div className="w-full max-w-[100] text-center">
              <p>{locale === "nb" ? "Brukere" : "Users"}</p>
            </div>
          )}
          <div className="w-full max-w-[100] text-center">
            <p>{locale === "nb" ? "Sist endret" : "Updated"}</p>
          </div>
        </div>
        {isArchiveAdmin && (
          <div className="invisible shrink-0" aria-hidden>
            <PillActions
              kind="folder"
              id=""
              name=""
              href="#"
              locale={locale}
              canEdit
              onChanged={loadFolders}
              status="active"
              isPinned={false}
              onPinChanged={handlePinChanged}
            />
          </div>
        )}
      </div>

      <PinnedFoldersSection
        locale={locale}
        canEdit={isArchiveAdmin}
        refreshKey={pinRefreshKey}
        onChanged={handlePinChanged}
        onPinChanged={handlePinChanged}
      />

      <section className="mt-4 grid gap-6">
        <div className="min-w-0">
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
              <div className="grid gap-8">
                {sectionGroups.map((group) => (
                  <div key={group.id} className="min-w-0">
                    {group.name && <h2 className="mb-3 text-sm sm:text-base font-semibold text-logoblue">{group.name}</h2>}
                    <div className="divide-y divide-lineSecondary border-y border-lineSecondary">
                      {group.entries.map((folder) => {
                        const fields: PillField[] = [{ key: "entries", value: folder.entryCount }];
                        if (isArchiveAdmin) fields.push({ key: "users", value: folder.viewerCount });
                        fields.push({ key: "updated", value: formatLastModified(folder.updatedAt) });

                        return (
                          <EntityPill
                            key={folder.id}
                            kind="folder"
                            id={folder.id}
                            name={folder.name}
                            description={folder.description}
                            status={folder.status}
                            conditionFlags={folder}
                            href={`/dashboard/archive/${codeToUrlPath(folder.code)}`}
                            locale={locale}
                            code={folder.code}
                            showDescription={false}
                            mode={isArchiveAdmin ? "admin" : "viewer"}
                            fields={fields}
                            onChanged={loadFolders}
                            showFavorite={isArchiveAdmin}
                            isPinned={folder.isPinned}
                            onPinChanged={handlePinChanged}
                            codeWidthCh={codeWidthCh}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
