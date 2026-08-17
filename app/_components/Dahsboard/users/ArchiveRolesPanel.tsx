"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { ExpandablePanelList } from "@/app/_components/Dahsboard/archive/ExpandablePanelList";

type ArchiveRoleRow = {
  id: string;
  name: string;
};

type ArchiveRoleAssignmentRow = {
  roleId: string;
  platformUserId: string;
};

type ArchiveCoworker = {
  userId: string;
  email: string;
  username: string | null;
};

// Relocated from the old standalone `/dashboard/archive/roles` page into the
// User Management "Apps & roles" tab. This is purely Archive's named-group
// convenience for per-folder sharing (assign several coworkers to a role,
// then share a folder with the whole role at once) — unrelated to the
// enabled/level dial the rest of this tab controls, and not something this
// redesign changes.
export function ArchiveRolesPanel() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const archiveAccess = currentUser ? getModuleAccess(currentUser, "ARCHIVE") : { enabled: true, level: "ADMIN" as const };
  const hasAccess = archiveAccess.enabled && archiveAccess.level === "ADMIN";

  const [roles, setRoles] = useState<ArchiveRoleRow[]>([]);
  const [coworkers, setCoworkers] = useState<ArchiveCoworker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [renamingRoleId, setRenamingRoleId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [rowError, setRowError] = useState("");

  const [assignmentsByRoleId, setAssignmentsByRoleId] = useState<Record<string, ArchiveRoleAssignmentRow[]>>({});
  const [loadedRoleIds, setLoadedRoleIds] = useState<Record<string, boolean>>({});
  const [assignUserId, setAssignUserId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [unassigningUserId, setUnassigningUserId] = useState<string | null>(null);

  async function loadRoles() {
    try {
      setLoading(true);
      setError("");

      const [rolesRes, coworkersRes] = await Promise.all([
        fetch("/api/archive/roles", { credentials: "include", cache: "no-store" }),
        fetch("/api/archive/coworkers", { credentials: "include", cache: "no-store" }),
      ]);

      const rolesData = await rolesRes.json().catch(() => null);

      if (!rolesRes.ok || !rolesData?.ok) {
        setError(rolesData?.reason || "Failed to load roles");
        setRoles([]);
        return;
      }

      setRoles(rolesData.roles ?? []);

      const coworkersData = await coworkersRes.json().catch(() => null);
      if (coworkersRes.ok && coworkersData?.ok) {
        setCoworkers(coworkersData.coworkers ?? []);
      }
    } catch {
      setError("Failed to load roles");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;
    void loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, hasAccess]);

  async function handleCreateRole() {
    const name = newRoleName.trim();
    if (!name) return;

    try {
      setCreating(true);
      setCreateError("");

      const res = await fetch("/api/archive/roles", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setCreateError(data?.reason || "Failed to create role");
        return;
      }

      setNewRoleName("");
      setAddRoleOpen(false);
      await loadRoles();
    } catch {
      setCreateError("Failed to create role");
    } finally {
      setCreating(false);
    }
  }

  function toggleAddRole() {
    setAddRoleOpen((prev) => {
      const next = !prev;
      if (!next) {
        setNewRoleName("");
        setCreateError("");
      }
      return next;
    });
  }

  async function handleDeleteRole(roleId: string) {
    setRowError("");

    try {
      setDeletingRoleId(roleId);

      // A role assigned to coworkers is "in use" — deleting it would silently
      // un-share every folder shared with it. Check the freshest assignment
      // count (re-fetching even if a stale cached count says empty) before
      // ever asking for confirmation.
      const currentAssignments = await loadAssignments(roleId);

      if (currentAssignments === undefined) {
        setRowError(locale === "nb" ? "Kunne ikke sjekke om rollen er i bruk" : "Failed to check whether this role is in use");
        return;
      }

      if (currentAssignments.length > 0) {
        setRowError(
          locale === "nb"
            ? `Denne rollen er i bruk av ${currentAssignments.length} medlem${currentAssignments.length === 1 ? "" : "mer"} og kan ikke slettes. Fjern dem først.`
            : `This role is used by ${currentAssignments.length} member${currentAssignments.length === 1 ? "" : "s"} and can't be deleted. Remove them first.`,
        );
        return;
      }

      if (!confirm(locale === "nb" ? "Slette denne rollen?" : "Delete this role?")) return;

      const res = await fetch(`/api/archive/roles/${roleId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        // The API re-checks this same guard server-side (a direct API call
        // could otherwise skip the client-side check above), so surface its
        // friendlier message when present rather than the raw reason code.
        setRowError(data?.message || data?.reason || "Failed to delete role");
        return;
      }

      setRoles((prev) => prev.filter((r) => r.id !== roleId));
    } catch {
      setRowError("Failed to delete role");
    } finally {
      setDeletingRoleId(null);
    }
  }

  function startRename(role: ArchiveRoleRow) {
    setRenamingRoleId(role.id);
    setRenameValue(role.name);
  }

  async function handleRenameRole(roleId: string) {
    const name = renameValue.trim();
    if (!name) return;

    try {
      setRowError("");

      const res = await fetch(`/api/archive/roles/${roleId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setRowError(data?.reason || "Failed to rename role");
        return;
      }

      setRoles((prev) => prev.map((r) => (r.id === roleId ? { ...r, name } : r)));
      setRenamingRoleId(null);
    } catch {
      setRowError("Failed to rename role");
    }
  }

  async function loadAssignments(roleId: string): Promise<ArchiveRoleAssignmentRow[] | undefined> {
    const res = await fetch(`/api/archive/roles/${roleId}/assignments`, {
      credentials: "include",
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) return undefined;

    const assignments: ArchiveRoleAssignmentRow[] = data.assignments ?? [];
    setAssignmentsByRoleId((prev) => ({ ...prev, [roleId]: assignments }));
    setLoadedRoleIds((prev) => ({ ...prev, [roleId]: true }));
    return assignments;
  }

  function handleTogglePanel(roleId: string, expanded: boolean) {
    if (expanded && !loadedRoleIds[roleId]) {
      void loadAssignments(roleId);
    }
  }

  async function handleAssign(roleId: string) {
    if (!assignUserId) return;

    try {
      setAssigning(true);
      setRowError("");

      const res = await fetch(`/api/archive/roles/${roleId}/assignments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: assignUserId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setRowError(data?.reason || "Failed to assign role");
        return;
      }

      setAssignUserId("");
      await loadAssignments(roleId);
    } catch {
      setRowError("Failed to assign role");
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign(roleId: string, userId: string) {
    try {
      setUnassigningUserId(userId);
      setRowError("");

      const res = await fetch(`/api/archive/roles/${roleId}/assignments`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setRowError(data?.reason || "Failed to remove role assignment");
        return;
      }

      await loadAssignments(roleId);
    } catch {
      setRowError("Failed to remove role assignment");
    } finally {
      setUnassigningUserId(null);
    }
  }

  if (currentUser && !hasAccess) {
    return (
      <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
        {locale === "nb"
          ? "Du må være arkivadministrator for å administrere roller."
          : "You need Archive admin access to manage roles."}
      </div>
    );
  }

  // /api/archive/coworkers excludes the caller (it was built for the
  // folder-sharing picker, where "share with yourself" is meaningless), but
  // that exclusion doesn't fit here — assigning yourself to a group is
  // completely normal. Rather than change the shared endpoint (and affect
  // folder sharing too), inject self locally the same way
  // EntitySettingsPanel's owner-picker already does.
  const assignableCoworkers: ArchiveCoworker[] = currentUser
    ? [{ userId: currentUser.id, email: currentUser.email, username: currentUser.username || null }, ...coworkers]
    : coworkers;

  const coworkerById = new Map(assignableCoworkers.map((c) => [c.userId, c]));

  const panelItems = roles.map((role) => {
    const assignments = assignmentsByRoleId[role.id] ?? [];
    const memberCountLabel =
      assignments.length === 1
        ? locale === "nb"
          ? "1 medlem"
          : "1 member"
        : locale === "nb"
          ? `${assignments.length} medlemmer`
          : `${assignments.length} members`;

    const isRenaming = renamingRoleId === role.id;
    // Only known once this role's panel has been expanded at least once —
    // otherwise we haven't fetched its assignments yet. handleDeleteRole
    // re-checks the live count regardless, this is just the proactive
    // disabled-state hint for a role we already know is in use.
    const knownInUse = loadedRoleIds[role.id] && assignments.length > 0;

    return {
      id: role.id,
      title: isRenaming ? (
        <input
          className="customInput w-full max-w-60 rounded-lg py-1 text-[15px] font-bold"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleRenameRole(role.id);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setRenamingRoleId(null);
            }
          }}
          type="text"
          autoFocus
        />
      ) : (
        role.name
      ),
      subtitle: loadedRoleIds[role.id] ? memberCountLabel : "",
      headerActions: isRenaming ? (
        <>
          <button
            type="button"
            className="shrink-0 rounded-full bg-logoblue px-3.5 py-1.5 text-xs font-bold text-white hover:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              void handleRenameRole(role.id);
            }}
          >
            {locale === "nb" ? "Lagre" : "Save"}
          </button>
          <button
            type="button"
            className="shrink-0 rounded-full border border-lineSecondary px-3.5 py-1.5 text-xs font-bold text-textColorSecond hover:bg-black/3"
            onClick={(e) => {
              e.stopPropagation();
              setRenamingRoleId(null);
            }}
          >
            {locale === "nb" ? "Avbryt" : "Cancel"}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="shrink-0 rounded-full border border-lineSecondary px-3.5 py-1.5 text-xs font-bold text-textColorSecond hover:bg-black/3"
            onClick={(e) => {
              e.stopPropagation();
              startRename(role);
            }}
          >
            {locale === "nb" ? "Endre navn" : "Rename"}
          </button>
          <button
            type="button"
            className="shrink-0 rounded-full border border-red-200 px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              void handleDeleteRole(role.id);
            }}
            disabled={deletingRoleId === role.id || knownInUse}
            title={
              knownInUse
                ? locale === "nb"
                  ? "Denne rollen har medlemmer — fjern dem først"
                  : "This role has members — remove them first"
                : undefined
            }
          >
            {deletingRoleId === role.id ? (locale === "nb" ? "Sletter..." : "Deleting...") : locale === "nb" ? "Slett" : "Delete"}
          </button>
        </>
      ),
      content: (
        <div>
          {!loadedRoleIds[role.id] ? (
            <div className="text-sm text-textColorThird">{locale === "nb" ? "Laster medlemmer..." : "Loading members..."}</div>
          ) : assignments.length === 0 ? (
            <div className="mb-3 text-sm text-textColorThird">
              {locale === "nb" ? "Ingen medlemmer i denne rollen" : "No members in this role"}
            </div>
          ) : (
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {assignments.map((assignment) => {
                const coworker = coworkerById.get(assignment.platformUserId);
                const label = coworker?.username || coworker?.email || assignment.platformUserId;
                return (
                  <div
                    key={assignment.platformUserId}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-full border border-lineSecondary bg-black/2 py-1.5 pr-1.5 pl-3.5"
                  >
                    <span className="min-w-0 truncate text-sm font-semibold text-textcolor">{label}</span>
                    <button
                      type="button"
                      onClick={() => void handleUnassign(role.id, assignment.platformUserId)}
                      disabled={unassigningUserId === assignment.platformUserId}
                      aria-label={locale === "nb" ? `Fjern ${label}` : `Remove ${label}`}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-textColorThird hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200] flex-1">
              <select
                className="customInput w-full"
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                disabled={assigning}
              >
                <option value="">{locale === "nb" ? "Velg kollega..." : "Select coworker..."}</option>
                {assignableCoworkers
                  .filter((c) => !assignments.some((a) => a.platformUserId === c.userId))
                  .map((coworker) => (
                    <option key={coworker.userId} value={coworker.userId}>
                      {coworker.username || coworker.email}
                      {coworker.userId === currentUser?.id ? (locale === "nb" ? " (deg)" : " (you)") : ""}
                    </option>
                  ))}
              </select>
            </div>

            <button type="button" className="customButtonEnabled h-10 px-6" onClick={() => void handleAssign(role.id)} disabled={assigning || !assignUserId}>
              {assigning ? (locale === "nb" ? "Legger til..." : "Adding...") : locale === "nb" ? "Legg til" : "Add"}
            </button>
          </div>
        </div>
      ),
    };
  });

  return (
    <div className="customContainer">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[19px] font-bold text-textcolor">
            {locale === "nb" ? "Mappedelingsgrupper" : "Folder-sharing groups"}
          </h2>
          <p className="mt-1 max-w-lg text-sm text-textColorThird">
            {locale === "nb"
              ? "Opprett navngitte roller og tildel dem til flere kollegaer, slik at du kan dele mapper med hele rollen på en gang. Dette er adskilt fra Admin/Viewer-tilgangen over."
              : "Create named groups and assign multiple coworkers to them, so folders can be shared with the whole group at once. Separate from the Admin/Viewer access above."}
          </p>
        </div>

        <button
          type="button"
          onClick={toggleAddRole}
          className={`shrink-0 rounded-full border px-4.5 py-2 text-[13px] font-bold transition-colors ${
            addRoleOpen
              ? "border-lineSecondary bg-white text-textColorSecond hover:bg-black/3"
              : "border-logoblue/30 bg-white text-logoblue hover:bg-logoblue/4"
          }`}
        >
          {addRoleOpen ? (locale === "nb" ? "Avbryt" : "Cancel") : `+ ${locale === "nb" ? "Legg til rolle" : "Add role"}`}
        </button>
      </div>

      {rowError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{rowError}</div>
      )}

      {addRoleOpen && (
        <div className="mt-4 rounded-2xl border border-logoblue/25 bg-logoblue/3 p-4">
          <label className="mb-2 block text-[12.5px] font-bold text-textColorSecond">
            {locale === "nb" ? "Hva skal gruppen hete?" : "What should this group be called?"}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="customInput min-w-55 max-w-75 flex-1 rounded-full text-[13px]"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreateRole();
                }
              }}
              placeholder={locale === "nb" ? "f.eks. Sjåfører, Kontor" : "e.g. Drivers, Office staff"}
              type="text"
              disabled={creating}
              autoFocus
            />
            <button
              type="button"
              className="customButtonEnabled shrink-0 rounded-full"
              onClick={() => void handleCreateRole()}
              disabled={creating || !newRoleName.trim()}
            >
              {creating ? (locale === "nb" ? "Oppretter..." : "Creating...") : locale === "nb" ? "Opprett" : "Create"}
            </button>
          </div>

          {createError && <p className="mt-2 text-sm font-medium text-red-600">{createError}</p>}
        </div>
      )}

      <div className="mt-5">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-textColorThird">
            {locale === "nb" ? "Laster roller..." : "Loading roles..."}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center border-red-200! bg-red-50 py-10 text-sm font-medium text-red-600">{error}</div>
        ) : (
          <ExpandablePanelList
            items={panelItems}
            onToggle={handleTogglePanel}
            emptyMessage={locale === "nb" ? "Ingen roller opprettet" : "No roles created yet"}
          />
        )}
      </div>
    </div>
  );
}
