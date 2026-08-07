import { useEffect, useState } from "react";
import type { RecurrenceType } from "@prisma/client";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { EntitySettingsPanel } from "@/app/_components/Dahsboard/archive/EntitySettingsPanel";
import { ReminderSettingsPanel } from "@/app/_components/Dahsboard/archive/ReminderSettingsPanel";
import { FolderPill } from "@/app/_components/Dahsboard/archive/FolderPill";
import { ItemPill } from "@/app/_components/Dahsboard/archive/ItemPill";
import { SectionedEntityManager } from "@/app/_components/Dahsboard/archive/SectionedEntityManager";
import { codeToUrlPath } from "@/app/_components/Dahsboard/archive/types";
import type { ArchiveFolderSummary, ArchiveItemSummary } from "@/app/_components/Dahsboard/archive/types";

type ArchiveFolderDetail = ArchiveFolderSummary & {
  reminderDescription: string | null;
  reminderRecurrenceType: RecurrenceType | null;
  reminderRecurrenceConfig: unknown | null;
};
type ArchiveItemRow = ArchiveItemSummary;
type ArchiveChildFolderRow = ArchiveFolderSummary;

type ArchivePermissionAction =
  | "view"
  | "create"
  | "upload"
  | "edit"
  | "delete"
  | "restore"
  | "move"
  | "manage_metadata"
  | "manage_status"
  | "manage_permissions";

type ArchivePermissionSubjectType = "user" | "role";

type ArchivePermissionRule = {
  subjectType: ArchivePermissionSubjectType;
  subjectId: string;
  action: ArchivePermissionAction;
};

type ArchiveCoworker = {
  userId: string;
  email: string;
  username: string | null;
};

type ArchiveRoleOption = {
  id: string;
  name: string;
};

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

  const [canManageSharing, setCanManageSharing] = useState(false);
  const [permissionRules, setPermissionRules] = useState<ArchivePermissionRule[]>([]);
  const [coworkers, setCoworkers] = useState<ArchiveCoworker[]>([]);
  const [roles, setRoles] = useState<ArchiveRoleOption[]>([]);
  const [canShareWithRoles, setCanShareWithRoles] = useState(false);
  const [shareTargetType, setShareTargetType] = useState<ArchivePermissionSubjectType>("user");
  const [shareUserId, setShareUserId] = useState("");
  const [shareRoleId, setShareRoleId] = useState("");
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

  async function handleGrantShare() {
    const subjectId = shareTargetType === "role" ? shareRoleId : shareUserId;
    if (!subjectId) return;

    try {
      setSharing(true);
      setShareError("");

      // Access-level (viewer/contributor/manage) is not chosen here — that
      // belongs on the user/role's profile in user management once that
      // exists. For now, sharing just grants "view" so the folder shows up
      // for them at all.
      const res = await fetch(`/api/archive/folders/${folderId}/permissions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType: shareTargetType, subjectId, actions: ["view"] }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setShareError(data?.reason || "Failed to share folder");
        return;
      }

      setShareUserId("");
      setShareRoleId("");
      await loadSharing();
    } catch {
      setShareError("Failed to share folder");
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

  type SharedSubject = { subjectType: ArchivePermissionSubjectType; subjectId: string; actions: ArchivePermissionAction[] };
  const sharedSubjects = new Map<string, SharedSubject>();
  for (const rule of permissionRules) {
    if (rule.subjectType === "user" && rule.subjectId === currentUser?.id) continue;
    const key = `${rule.subjectType}:${rule.subjectId}`;
    const existing = sharedSubjects.get(key);
    if (existing) {
      existing.actions.push(rule.action);
    } else {
      sharedSubjects.set(key, { subjectType: rule.subjectType, subjectId: rule.subjectId, actions: [rule.action] });
    }
  }
  const coworkerById = new Map(coworkers.map((c) => [c.userId, c]));
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const sharedSubjectList = Array.from(sharedSubjects.values());
  const sharedUserSubjects = sharedSubjectList.filter((s) => s.subjectType === "user");
  const sharedRoleSubjects = sharedSubjectList.filter((s) => s.subjectType === "role");
  const shareableCoworkers = coworkers.filter((c) => !sharedUserSubjects.some((s) => s.subjectId === c.userId));
  const shareableRoles = roles.filter((r) => !sharedRoleSubjects.some((s) => s.subjectId === r.id));

  function renderAccessRow(subject: SharedSubject, label: string) {
    return (
      <div key={`${subject.subjectType}:${subject.subjectId}`} className="flex items-center justify-between gap-4 py-2 text-sm">
        <div>
          <span className="font-medium text-textcolor">{label}</span>
          <span className="ml-2 text-textColorThird">{subject.actions.join(", ")}</span>
        </div>
        <button
          type="button"
          className="text-red-600 hover:underline"
          onClick={() => void handleRevokeShare(subject.subjectType, subject.subjectId, subject.actions)}
          disabled={revokingSubject === subject.subjectId}
        >
          {locale === "nb" ? "Fjern" : "Remove"}
        </button>
      </div>
    );
  }

  const sharingContent = (
    <div className="grid gap-6">
      <div className="rounded-xl border border-lineSecondary p-4">
        <h3 className="mb-3 text-sm font-semibold text-textColorThird">
          {locale === "nb" ? "Gi tilgang" : "Grant access"}
        </h3>

        {canShareWithRoles && (
          <div className="mb-3 flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={shareTargetType === "user"}
                onChange={() => setShareTargetType("user")}
                disabled={sharing}
              />
              {locale === "nb" ? "Kollega" : "Coworker"}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={shareTargetType === "role"}
                onChange={() => setShareTargetType("role")}
                disabled={sharing}
              />
              {locale === "nb" ? "Rolle" : "Role"}
            </label>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          {shareTargetType === "role" ? (
            <div className="min-w-[200] flex-1">
              <label className="block pb-2 text-sm">{locale === "nb" ? "Rolle" : "Role"}</label>
              <select
                className="customInput w-full"
                value={shareRoleId}
                onChange={(e) => setShareRoleId(e.target.value)}
                disabled={sharing}
              >
                <option value="">{locale === "nb" ? "Velg..." : "Select..."}</option>
                {shareableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="min-w-[200] flex-1">
              <label className="block pb-2 text-sm">{locale === "nb" ? "Kollega" : "Coworker"}</label>
              <select
                className="customInput w-full"
                value={shareUserId}
                onChange={(e) => setShareUserId(e.target.value)}
                disabled={sharing}
              >
                <option value="">{locale === "nb" ? "Velg..." : "Select..."}</option>
                {shareableCoworkers.map((coworker) => (
                  <option key={coworker.userId} value={coworker.userId}>
                    {coworker.username || coworker.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            className="customButtonEnabled h-10 px-6"
            onClick={() => void handleGrantShare()}
            disabled={sharing || (shareTargetType === "role" ? !shareRoleId : !shareUserId)}
          >
            {sharing ? (locale === "nb" ? "Deler..." : "Sharing...") : locale === "nb" ? "Del" : "Share"}
          </button>
        </div>

        {shareError && <p className="mt-3 text-sm font-medium text-red-600">{shareError}</p>}
      </div>

      <div className="grid gap-4">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-textColorThird">
            {locale === "nb" ? "Kolleger med tilgang" : "Users with access"}
          </h4>
          {sharedUserSubjects.length > 0 ? (
            <div className="divide-y divide-lineSecondary border-y border-lineSecondary">
              {sharedUserSubjects.map((subject) =>
                renderAccessRow(
                  subject,
                  coworkerById.get(subject.subjectId)?.username || coworkerById.get(subject.subjectId)?.email || subject.subjectId,
                ),
              )}
            </div>
          ) : (
            <p className="text-sm text-textColorThird">
              {locale === "nb" ? "Ingen kolleger har tilgang" : "No users have access"}
            </p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-textColorThird">
            {locale === "nb" ? "Roller med tilgang" : "Roles with access"}
          </h4>
          {sharedRoleSubjects.length > 0 ? (
            <div className="divide-y divide-lineSecondary border-y border-lineSecondary">
              {sharedRoleSubjects.map((subject) =>
                renderAccessRow(subject, roleById.get(subject.subjectId)?.name ?? subject.subjectId),
              )}
            </div>
          ) : (
            <p className="text-sm text-textColorThird">{locale === "nb" ? "Ingen roller har tilgang" : "No roles have access"}</p>
          )}
        </div>
      </div>
    </div>
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
          <h2 className="mb-3 text-[1.5rem] font-bold text-logoblue">
            {locale === "nb" ? "Arkivkontroller" : "Archive controls"}
          </h2>

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
            <FolderPill
              key={childFolder.id}
              folder={childFolder}
              href={`/dashboard/archive/${codeToUrlPath(childFolder.code)}`}
              locale={locale}
              showStats={false}
              canEdit
              onChanged={loadFolderAndItems}
            />
          )}
          renderItemRow={(item) => (
            <ItemPill
              key={item.id}
              item={item}
              href={`/dashboard/archive/${codeToUrlPath(item.code)}`}
              locale={locale}
              canEdit
              onChanged={loadFolderAndItems}
            />
          )}
        />
      )}
    </div>
  );
}
