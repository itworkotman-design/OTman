import { useEffect, useState } from "react";
import type { RecurrenceType } from "@prisma/client";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { EntitySettingsPanel } from "@/app/_components/Dahsboard/archive/EntitySettingsPanel";
import { ReminderSettingsPanel } from "@/app/_components/Dahsboard/archive/ReminderSettingsPanel";
import { EntityPill } from "@/app/_components/Dahsboard/archive/EntityPill";
import { SectionedEntityManager } from "@/app/_components/Dahsboard/archive/SectionedEntityManager";
import { FolderSharingPanel } from "@/app/_components/Dahsboard/archive/FolderSharingPanel";
import type {
  ArchiveCoworker,
  ArchivePermissionAction,
  ArchivePermissionRule,
  ArchivePermissionSubjectType,
  ArchiveRoleOption,
  FolderDefaultAccessRow,
} from "@/app/_components/Dahsboard/archive/FolderSharingPanel";
import { codeToUrlPath, formatLastModified } from "@/app/_components/Dahsboard/archive/types";
import type { ArchiveFolderSummary, ArchiveItemSummary } from "@/app/_components/Dahsboard/archive/types";

// Denies a person's default (Admin/Viewer role) access on this exact
// folder — the only way to exclude someone whose access comes from the
// company default (see grantDefaultRoleAccessOnRootFolder in
// lib/docArchive/context.ts) rather than a local grant. The full content
// bundle (not just `view`) so it blocks both an Admin-level and a
// Viewer-level default uniformly, and — because a deny falls through to
// descendants the same way the default itself does — this also excludes
// them from every subfolder beneath this one, not just this folder.
const DEFAULT_ACCESS_DENY_ACTIONS: ArchivePermissionAction[] = [
  "view",
  "create",
  "upload",
  "edit",
  "delete",
  "restore",
  "move",
  "manage_metadata",
  "manage_status",
];

type ArchiveFolderDetail = ArchiveFolderSummary & {
  reminderDescription: string | null;
  reminderRecurrenceType: RecurrenceType | null;
  reminderRecurrenceConfig: unknown | null;
};
type ArchiveItemRow = ArchiveItemSummary;
type ArchiveChildFolderRow = ArchiveFolderSummary;

// Every mutation for this folder lives here — permissions, folder
// status/dates, creating/deleting subfolders and items — matching the
// otman-archive prototype's ArchiveSettingsView. The folder view
// (`FolderView`) is pure browsing. `codePath` is this folder's own code
// split on "." — used to build the back link and this folder's own
// settings-relative links.
export function FolderSettingsView({ folderId, codePath }: { folderId: string; codePath: string[] }) {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const archiveAccess = currentUser ? getModuleAccess(currentUser, "ARCHIVE") : { enabled: true, level: "ADMIN" as const };
  const hasAccess = archiveAccess.enabled && archiveAccess.level === "ADMIN";

  const [folder, setFolder] = useState<ArchiveFolderDetail | null>(null);
  const [items, setItems] = useState<ArchiveItemRow[]>([]);
  const [childFolders, setChildFolders] = useState<ArchiveChildFolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Matches the top tab-switching style from user management
  // (app/(User)/dashboard/users/page.tsx) — one tab always fully shown
  // rather than the old click-to-expand accordion rows.
  const [activeControlTab, setActiveControlTab] = useState("folder-settings");
  // Collapsed by default on entering settings — Content is usually what
  // someone's here for, so Archive controls starts out of the way.
  const [controlsExpanded, setControlsExpanded] = useState(false);

  const [canManageSharing, setCanManageSharing] = useState(false);
  const [permissionRules, setPermissionRules] = useState<ArchivePermissionRule[]>([]);
  const [defaultAccess, setDefaultAccess] = useState<FolderDefaultAccessRow[]>([]);
  const [coworkers, setCoworkers] = useState<ArchiveCoworker[]>([]);
  const [roles, setRoles] = useState<ArchiveRoleOption[]>([]);
  const [canShareWithRoles, setCanShareWithRoles] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [revokingSubject, setRevokingSubject] = useState<string | null>(null);

  async function loadFolderAndItems() {
    try {
      setLoading(true);
      setError("");

      const [folderRes, itemsRes, childrenRes] = await Promise.all([
        fetch(`/api/archive/folders/${folderId}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/items`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/children`, { credentials: "include", cache: "no-store" }),
      ]);

      const folderData = await folderRes.json().catch(() => null);
      const itemsData = await itemsRes.json().catch(() => null);
      const childrenData = await childrenRes.json().catch(() => null);

      if (!folderRes.ok || !folderData?.ok) {
        setError(folderData?.reason || "Failed to load folder");
        return;
      }

      setFolder(folderData.folder);

      if (!itemsRes.ok || !itemsData?.ok) {
        setError(itemsData?.reason || "Failed to load items");
        return;
      }

      setItems(itemsData.items ?? []);

      if (childrenRes.ok && childrenData?.ok) {
        setChildFolders(childrenData.folders ?? []);
      }
    } catch {
      setError("Failed to load folder");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;
    if (!folderId) return;
    void loadFolderAndItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, hasAccess, folderId]);

  async function loadSharing() {
    try {
      const [rulesRes, coworkersRes, rolesRes] = await Promise.all([
        fetch(`/api/archive/folders/${folderId}/permissions`, { credentials: "include", cache: "no-store" }),
        fetch("/api/archive/coworkers", { credentials: "include", cache: "no-store" }),
        fetch("/api/archive/roles", { credentials: "include", cache: "no-store" }),
      ]);

      const rulesData = await rulesRes.json().catch(() => null);

      if (!rulesRes.ok || !rulesData?.ok) {
        setCanManageSharing(false);
        return;
      }

      setCanManageSharing(true);
      setPermissionRules(rulesData.rules ?? []);
      setDefaultAccess(
        ((rulesData.effectiveAccess ?? []) as { userId: string; source: string }[])
          .filter((row): row is { userId: string; source: "admin-role" | "viewer-role" } =>
            row.source === "admin-role" || row.source === "viewer-role",
          )
          .map((row) => ({ userId: row.userId, source: row.source })),
      );

      const coworkersData = await coworkersRes.json().catch(() => null);
      if (coworkersRes.ok && coworkersData?.ok) {
        setCoworkers(coworkersData.coworkers ?? []);
      }

      const rolesData = await rolesRes.json().catch(() => null);
      if (rolesRes.ok && rolesData?.ok) {
        setCanShareWithRoles(true);
        setRoles(rolesData.roles ?? []);
      } else {
        setCanShareWithRoles(false);
      }
    } catch {
      setCanManageSharing(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;
    if (!folderId) return;
    void loadSharing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, hasAccess, folderId]);

  async function handleGrantShare(
    subjectType: ArchivePermissionSubjectType,
    subjectId: string,
    actions: ArchivePermissionAction[],
  ): Promise<boolean> {
    try {
      setSharing(true);
      setShareError("");

      const res = await fetch(`/api/archive/folders/${folderId}/permissions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType, subjectId, actions }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setShareError(data?.reason || "Failed to share folder");
        return false;
      }

      await loadSharing();
      return true;
    } catch {
      setShareError("Failed to share folder");
      return false;
    } finally {
      setSharing(false);
    }
  }

  async function handleRevokeShare(
    subjectType: ArchivePermissionSubjectType,
    subjectId: string,
    actions: ArchivePermissionAction[],
  ) {
    if (!confirm(locale === "nb" ? "Fjerne denne tilgangen?" : "Remove this access?")) return;

    try {
      setRevokingSubject(subjectId);
      setShareError("");

      const res = await fetch(`/api/archive/folders/${folderId}/permissions`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType, subjectId, actions }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setShareError(data?.reason || "Failed to remove access");
        return;
      }

      await loadSharing();
    } catch {
      setShareError("Failed to remove access");
    } finally {
      setRevokingSubject(null);
    }
  }

  async function handleRemoveDefaultAccess(userId: string): Promise<boolean> {
    if (!confirm(locale === "nb" ? "Fjerne denne tilgangen?" : "Remove this access?")) return false;

    try {
      setShareError("");

      const res = await fetch(`/api/archive/folders/${folderId}/permissions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: "user",
          subjectId: userId,
          actions: DEFAULT_ACCESS_DENY_ACTIONS,
          effect: "deny",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setShareError(data?.reason || "Failed to remove access");
        return false;
      }

      await loadSharing();
      return true;
    } catch {
      setShareError("Failed to remove access");
      return false;
    }
  }

  async function handleCreateItem(sectionId: string, name: string, description: string | null) {
    try {
      const res = await fetch(`/api/archive/folders/${folderId}/items`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, sectionId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        return { ok: false, reason: data?.reason || "Failed to create item" };
      }

      await loadFolderAndItems();
      return { ok: true };
    } catch {
      return { ok: false, reason: "Failed to create item" };
    }
  }

  async function handleCreateSubfolder(sectionId: string, name: string, description: string | null) {
    try {
      const res = await fetch("/api/archive/folders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, parentFolderId: folderId, sectionId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        return { ok: false, reason: data?.reason || "Failed to create subfolder" };
      }

      await loadFolderAndItems();
      return { ok: true };
    } catch {
      return { ok: false, reason: "Failed to create subfolder" };
    }
  }

  async function handleFolderSettingsSaved() {
    await loadFolderAndItems();
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

  const sharingContent = (
    <FolderSharingPanel
      locale={locale}
      ownerUserId={folder?.ownerUserId ?? null}
      currentUserId={currentUser?.id}
      permissionRules={permissionRules}
      defaultAccess={defaultAccess}
      coworkers={coworkers}
      roles={roles}
      canShareWithRoles={canShareWithRoles}
      sharing={sharing}
      shareError={shareError}
      revokingSubject={revokingSubject}
      onGrant={handleGrantShare}
      onRevoke={(subjectType, subjectId, actions) => void handleRevokeShare(subjectType, subjectId, actions)}
      onRemoveDefaultAccess={handleRemoveDefaultAccess}
    />
  );

  const controlItems = [
    ...(canManageSharing
      ? [
          {
            id: "permissions",
            title: locale === "nb" ? "Deling" : "Permissions",
            content: sharingContent,
          },
        ]
      : []),
    ...(folder
      ? [
          {
            id: "folder-settings",
            title: locale === "nb" ? "Mappeinnstillinger" : "Folder settings",
            content: (
              <EntitySettingsPanel
                kind="folder"
                id={folderId}
                name={folder.name}
                description={folder.description}
                status={folder.status}
                ownerUserId={folder.ownerUserId}
                locale={locale}
                onSaved={() => void handleFolderSettingsSaved()}
              />
            ),
          },
          {
            id: "reminders",
            title: locale === "nb" ? "Påminnelser" : "Reminders",
            dotColor: folder.reminderRecurrenceType ? "bg-green-500" : "bg-gray-300",
            content: (
              <ReminderSettingsPanel
                kind="folder"
                id={folderId}
                dueAt={folder.dueAt}
                expiresAt={folder.expiresAt}
                reminderDescription={folder.reminderDescription}
                reminderRecurrenceType={folder.reminderRecurrenceType}
                reminderRecurrenceConfig={folder.reminderRecurrenceConfig}
                locale={locale}
                onSaved={() => void handleFolderSettingsSaved()}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="w-full">
      <div className="mb-6">
        <Link href={`/dashboard/archive/${codePath.join("/")}`} className="text-sm text-textColorThird hover:underline">
          ← {loading ? "..." : folder?.name || (locale === "nb" ? "Ukjent mappe" : "Unknown folder")}
        </Link>
      </div>

      <h1 className="mb-8 text-center text-2xl font-semibold text-logoblue lg:text-4xl">
        {loading
          ? "..."
          : `${folder?.name || (locale === "nb" ? "Ukjent mappe" : "Unknown folder")} ${locale === "nb" ? "innstillinger" : "Settings"}`}
      </h1>

      {error && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {controlItems.length > 0 && (
        <section className="mb-6">
          <button
            type="button"
            onClick={() => setControlsExpanded((v) => !v)}
            className="mb-3 flex w-full items-center gap-2 text-left text-[1.5rem] font-bold text-logoblue"
            aria-expanded={controlsExpanded}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="none"
              className={`shrink-0 transition-transform ${controlsExpanded ? "rotate-90" : ""}`}
              aria-hidden="true"
            >
              <path d="M5 3l6 5-6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {locale === "nb" ? "Arkivkontroller" : "Archive controls"}
          </button>

          {controlsExpanded && (
            <>
              <div className="mb-6 flex gap-2 border-b border-lineSecondary">
                {controlItems.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveControlTab(tab.id)}
                    className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                      activeControlTab === tab.id
                        ? "border-logoblue text-logoblue"
                        : "border-transparent text-textColorThird hover:text-textColorSecond"
                    }`}
                  >
                    {tab.title}
                    {"dotColor" in tab && <span className={`h-2 w-2 rounded-full ${tab.dotColor}`} />}
                  </button>
                ))}
              </div>

              {controlItems.map((tab) => (tab.id === activeControlTab ? <div key={tab.id}>{tab.content}</div> : null))}
            </>
          )}
        </section>
      )}

      {!loading && (
        <SectionedEntityManager
          parentFolderId={folderId}
          locale={locale}
          folders={childFolders}
          items={items}
          onFoldersChanged={loadFolderAndItems}
          onItemsChanged={loadFolderAndItems}
          onCreateSubfolder={handleCreateSubfolder}
          onCreateItem={handleCreateItem}
          renderFolderRow={(childFolder) => (
            <EntityPill
              key={childFolder.id}
              kind="folder"
              id={childFolder.id}
              name={childFolder.name}
              description={childFolder.description}
              status={childFolder.status}
              conditionFlags={childFolder}
              href={`/dashboard/archive/${codeToUrlPath(childFolder.code)}`}
              locale={locale}
              code={childFolder.code}
              mode="admin"
              fields={[{ key: "updated", value: formatLastModified(childFolder.updatedAt) }]}
              onChanged={loadFolderAndItems}
            />
          )}
          renderItemRow={(item) => (
            <EntityPill
              key={item.id}
              kind="item"
              id={item.id}
              name={item.name}
              description={item.description}
              status={item.status}
              conditionFlags={item}
              href={`/dashboard/archive/${codeToUrlPath(item.code)}`}
              locale={locale}
              code={item.code}
              mode="admin"
              fields={[{ key: "updated", value: formatLastModified(item.updatedAt) }]}
              onChanged={loadFolderAndItems}
            />
          )}
        />
      )}
    </div>
  );
}
