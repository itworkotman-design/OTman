"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { canAccessArchive } from "@/lib/users/access";
import { ExpandablePanelList } from "@/app/_components/Dahsboard/archive/ExpandablePanelList";
import { EntitySettingsPanel } from "@/app/_components/Dahsboard/archive/EntitySettingsPanel";
import { EditableEntityRow } from "@/app/_components/Dahsboard/archive/EditableEntityRow";
import type { ArchiveFolderSummary, ArchiveItemSummary } from "@/app/_components/Dahsboard/archive/types";

type ArchiveFolderDetail = ArchiveFolderSummary;
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

const CONTRIBUTOR_ACTIONS: ArchivePermissionAction[] = [
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

const VIEWER_ACTIONS: ArchivePermissionAction[] = ["view"];

// Every mutation for this folder lives here — permissions, folder
// status/dates, creating/deleting subfolders and items — matching the
// otman-archive prototype's ArchiveSettingsView. The folder view page
// (`../page.tsx`) is pure browsing.
export default function ArchiveFolderSettingsPage() {
  const params = useParams<{ folderId: string }>();
  const folderId = params.folderId;

  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const hasAccess = currentUser ? canAccessArchive(currentUser.role, currentUser.permissions) : true;

  const [folder, setFolder] = useState<ArchiveFolderDetail | null>(null);
  const [items, setItems] = useState<ArchiveItemRow[]>([]);
  const [childFolders, setChildFolders] = useState<ArchiveChildFolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rowActionError, setRowActionError] = useState("");

  const [newItemName, setNewItemName] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [newSubfolderDescription, setNewSubfolderDescription] = useState("");
  const [creatingSubfolder, setCreatingSubfolder] = useState(false);
  const [createSubfolderError, setCreateSubfolderError] = useState("");
  const [deletingChildFolderId, setDeletingChildFolderId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const [canManageSharing, setCanManageSharing] = useState(false);
  const [permissionRules, setPermissionRules] = useState<ArchivePermissionRule[]>([]);
  const [coworkers, setCoworkers] = useState<ArchiveCoworker[]>([]);
  const [roles, setRoles] = useState<ArchiveRoleOption[]>([]);
  const [canShareWithRoles, setCanShareWithRoles] = useState(false);
  const [shareTargetType, setShareTargetType] = useState<ArchivePermissionSubjectType>("user");
  const [shareUserId, setShareUserId] = useState("");
  const [shareRoleId, setShareRoleId] = useState("");
  const [sharePreset, setSharePreset] = useState<"viewer" | "contributor">("viewer");
  const [shareAlsoManage, setShareAlsoManage] = useState(false);
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
  }, [currentUser, hasAccess, folderId]);

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
  }, [currentUser, hasAccess, folderId]);

  async function handleGrantShare() {
    const subjectId = shareTargetType === "role" ? shareRoleId : shareUserId;
    if (!subjectId) return;

    try {
      setSharing(true);
      setShareError("");

      const actions = [
        ...(sharePreset === "contributor" ? CONTRIBUTOR_ACTIONS : VIEWER_ACTIONS),
        ...(shareAlsoManage ? (["manage_permissions"] as ArchivePermissionAction[]) : []),
      ];

      const res = await fetch(`/api/archive/folders/${folderId}/permissions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType: shareTargetType, subjectId, actions }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setShareError(data?.reason || "Failed to share folder");
        return;
      }

      setShareUserId("");
      setShareRoleId("");
      setShareAlsoManage(false);
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

  async function handleCreateItem() {
    const name = newItemName.trim();
    if (!name) return;

    try {
      setCreating(true);
      setCreateError("");

      const res = await fetch(`/api/archive/folders/${folderId}/items`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: newItemDescription.trim() || null }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setCreateError(data?.reason || "Failed to create item");
        return;
      }

      setNewItemName("");
      setNewItemDescription("");
      await loadFolderAndItems();
    } catch {
      setCreateError("Failed to create item");
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateSubfolder() {
    const name = newSubfolderName.trim();
    if (!name) return;

    try {
      setCreatingSubfolder(true);
      setCreateSubfolderError("");

      const res = await fetch("/api/archive/folders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newSubfolderDescription.trim() || null,
          parentFolderId: folderId,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setCreateSubfolderError(data?.reason || "Failed to create subfolder");
        return;
      }

      setNewSubfolderName("");
      setNewSubfolderDescription("");
      await loadFolderAndItems();
    } catch {
      setCreateSubfolderError("Failed to create subfolder");
    } finally {
      setCreatingSubfolder(false);
    }
  }

  async function handleDeleteChildFolder(childFolderId: string) {
    if (!confirm(locale === "nb" ? "Slette denne mappen?" : "Delete this folder?")) return;

    try {
      setDeletingChildFolderId(childFolderId);
      setRowActionError("");

      const res = await fetch(`/api/archive/folders/${childFolderId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setRowActionError(data?.reason || "Failed to delete folder");
        return;
      }

      setChildFolders((prev) => prev.filter((f) => f.id !== childFolderId));
    } catch {
      setRowActionError("Failed to delete folder");
    } finally {
      setDeletingChildFolderId(null);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm(locale === "nb" ? "Slette dette elementet?" : "Delete this item?")) return;

    try {
      setDeletingItemId(itemId);
      setRowActionError("");

      const res = await fetch(`/api/archive/items/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setRowActionError(data?.reason || "Failed to delete item");
        return;
      }

      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      setRowActionError("Failed to delete item");
    } finally {
      setDeletingItemId(null);
    }
  }

  async function handleFolderSettingsSaved() {
    setRowActionError("");
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
  const sharedUserIds = new Set(
    Array.from(sharedSubjects.values()).filter((s) => s.subjectType === "user").map((s) => s.subjectId),
  );
  const sharedRoleIds = new Set(
    Array.from(sharedSubjects.values()).filter((s) => s.subjectType === "role").map((s) => s.subjectId),
  );
  const shareableCoworkers = coworkers.filter((c) => !sharedUserIds.has(c.userId));
  const shareableRoles = roles.filter((r) => !sharedRoleIds.has(r.id));

  const sharingContent = (
    <div>
      {sharedSubjects.size > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {Array.from(sharedSubjects.values()).map((subject) => {
            const label =
              subject.subjectType === "role"
                ? `${locale === "nb" ? "Rolle" : "Role"}: ${roleById.get(subject.subjectId)?.name ?? subject.subjectId}`
                : coworkerById.get(subject.subjectId)?.username ||
                  coworkerById.get(subject.subjectId)?.email ||
                  subject.subjectId;
            return (
              <div key={`${subject.subjectType}:${subject.subjectId}`} className="flex items-center justify-between gap-4 text-sm">
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
          })}
        </div>
      )}

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

        <div className="min-w-[160]">
          <label className="block pb-2 text-sm">{locale === "nb" ? "Tilgangsnivå" : "Access level"}</label>
          <select
            className="customInput w-full"
            value={sharePreset}
            onChange={(e) => setSharePreset(e.target.value as "viewer" | "contributor")}
            disabled={sharing}
          >
            <option value="viewer">{locale === "nb" ? "Kan se" : "Viewer"}</option>
            <option value="contributor">{locale === "nb" ? "Kan redigere" : "Contributor"}</option>
          </select>
        </div>

        <button
          type="button"
          className="customButtonEnabled h-10 px-6"
          onClick={() => void handleGrantShare()}
          disabled={sharing || (shareTargetType === "role" ? !shareRoleId : !shareUserId)}
        >
          {sharing ? (locale === "nb" ? "Deler..." : "Sharing...") : locale === "nb" ? "Del" : "Share"}
        </button>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-textColorThird">
        <input
          type="checkbox"
          checked={shareAlsoManage}
          onChange={(e) => setShareAlsoManage(e.target.checked)}
          disabled={sharing}
        />
        {locale === "nb"
          ? "La denne personen også administrere deling av mappen"
          : "Also let this person manage folder sharing"}
      </label>

      {shareError && <p className="mt-3 text-sm font-medium text-red-600">{shareError}</p>}
    </div>
  );

  const controlItems = [
    ...(canManageSharing
      ? [
          {
            id: "permissions",
            title: locale === "nb" ? "Deling" : "Permissions",
            columns: [],
            content: sharingContent,
          },
        ]
      : []),
    ...(folder
      ? [
          {
            id: "folder-settings",
            title: locale === "nb" ? "Mappeinnstillinger" : "Folder settings",
            columns: [folder.status],
            content: (
              <EntitySettingsPanel
                kind="folder"
                id={folderId}
                name={folder.name}
                description={folder.description}
                status={folder.status}
                dueAt={folder.dueAt}
                expiresAt={folder.expiresAt}
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
        <Link href={`/dashboard/archive/${folderId}`} className="text-sm text-textColorThird hover:underline">
          ← {loading ? "..." : folder?.name || (locale === "nb" ? "Ukjent mappe" : "Unknown folder")}
        </Link>
      </div>

      <h1 className="mb-8 whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
        {locale === "nb" ? "Mappeinnstillinger" : "Folder settings"}
      </h1>

      {error && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {rowActionError && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {rowActionError}
        </div>
      )}

      {controlItems.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-[1.5rem] font-bold text-logoblue">
            {locale === "nb" ? "Arkivkontroller" : "Archive controls"}
          </h2>
          <ExpandablePanelList items={controlItems} variant="white" />
        </section>
      )}

      <div className="customContainer mb-6 p-4">
        <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Ny undermappe" : "New subfolder"}</h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200] flex-1">
            <label className="block pb-2 text-sm">{locale === "nb" ? "Navn" : "Name"}</label>
            <input
              className="customInput w-full"
              value={newSubfolderName}
              onChange={(e) => setNewSubfolderName(e.target.value)}
              type="text"
              disabled={creatingSubfolder}
            />
          </div>

          <div className="min-w-[240] flex-1">
            <label className="block pb-2 text-sm">{locale === "nb" ? "Beskrivelse" : "Description"}</label>
            <input
              className="customInput w-full"
              value={newSubfolderDescription}
              onChange={(e) => setNewSubfolderDescription(e.target.value)}
              type="text"
              disabled={creatingSubfolder}
            />
          </div>

          <button
            type="button"
            className="customButtonEnabled h-10 px-6"
            onClick={() => void handleCreateSubfolder()}
            disabled={creatingSubfolder || !newSubfolderName.trim()}
          >
            {creatingSubfolder
              ? locale === "nb"
                ? "Oppretter..."
                : "Creating..."
              : locale === "nb"
                ? "Opprett"
                : "Create"}
          </button>
        </div>

        {createSubfolderError && <p className="mt-3 text-sm font-medium text-red-600">{createSubfolderError}</p>}
      </div>

      {childFolders.length > 0 && (
        <div className="mb-6 min-w-0 w-full overflow-x-auto">
          <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Undermapper" : "Subfolders"}</h2>
          <div className="grid gap-3">
            {childFolders.map((childFolder) => (
              <EditableEntityRow
                key={childFolder.id}
                name={childFolder.name}
                description={childFolder.description}
                status={childFolder.status}
                flags={childFolder}
                settingsHref={`/dashboard/archive/${childFolder.id}/settings`}
                onDelete={() => void handleDeleteChildFolder(childFolder.id)}
                deleting={deletingChildFolderId === childFolder.id}
                locale={locale}
              />
            ))}
          </div>
        </div>
      )}

      <div className="customContainer mb-6 p-4">
        <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Nytt element" : "New item"}</h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200] flex-1">
            <label className="block pb-2 text-sm">{locale === "nb" ? "Navn" : "Name"}</label>
            <input
              className="customInput w-full"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              type="text"
              disabled={creating}
            />
          </div>

          <div className="min-w-[240] flex-1">
            <label className="block pb-2 text-sm">{locale === "nb" ? "Beskrivelse" : "Description"}</label>
            <input
              className="customInput w-full"
              value={newItemDescription}
              onChange={(e) => setNewItemDescription(e.target.value)}
              type="text"
              disabled={creating}
            />
          </div>

          <button
            type="button"
            className="customButtonEnabled h-10 px-6"
            onClick={() => void handleCreateItem()}
            disabled={creating || !newItemName.trim()}
          >
            {creating ? (locale === "nb" ? "Oppretter..." : "Creating...") : locale === "nb" ? "Opprett" : "Create"}
          </button>
        </div>

        {createError && <p className="mt-3 text-sm font-medium text-red-600">{createError}</p>}
      </div>

      <div className="min-w-0 w-full overflow-x-auto">
        <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Elementer" : "Items"}</h2>
        {loading ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
            {locale === "nb" ? "Laster elementer..." : "Loading items..."}
          </div>
        ) : items.length === 0 ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
            {locale === "nb" ? "Ingen elementer funnet" : "No items found"}
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <EditableEntityRow
                key={item.id}
                name={item.name}
                description={item.description}
                status={item.status}
                flags={item}
                settingsHref={`/dashboard/archive/${folderId}/items/${item.id}/settings`}
                onDelete={() => void handleDeleteItem(item.id)}
                deleting={deletingItemId === item.id}
                locale={locale}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
