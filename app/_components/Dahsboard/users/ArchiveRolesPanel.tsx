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
      await loadRoles();
    } catch {
      setCreateError("Failed to create role");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteRole(roleId: string) {
    if (!confirm(locale === "nb" ? "Slette denne rollen?" : "Delete this role?")) return;

    try {
      setDeletingRoleId(roleId);
      setRowError("");

      const res = await fetch(`/api/archive/roles/${roleId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setRowError(data?.reason || "Failed to delete role");
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

  async function loadAssignments(roleId: string) {
    const res = await fetch(`/api/archive/roles/${roleId}/assignments`, {
      credentials: "include",
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) return;

    setAssignmentsByRoleId((prev) => ({ ...prev, [roleId]: data.assignments ?? [] }));
    setLoadedRoleIds((prev) => ({ ...prev, [roleId]: true }));
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

  const coworkerById = new Map(coworkers.map((c) => [c.userId, c]));

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

    return {
      id: role.id,
      title: role.name,
      subtitle: loadedRoleIds[role.id] ? memberCountLabel : "",
      content: (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {renamingRoleId === role.id ? (
              <>
                <input
                  className="customInput flex-1 min-w-[160]"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  type="text"
                />
                <button type="button" className="customButtonEnabled shrink-0" onClick={() => void handleRenameRole(role.id)}>
                  {locale === "nb" ? "Lagre" : "Save"}
                </button>
                <button type="button" className="customButtonDefault shrink-0" onClick={() => setRenamingRoleId(null)}>
                  {locale === "nb" ? "Avbryt" : "Cancel"}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="text-sm text-textColorThird hover:underline" onClick={() => startRename(role)}>
                  {locale === "nb" ? "Endre navn" : "Rename"}
                </button>
                <button
                  type="button"
                  className="customButtonDefault"
                  onClick={() => void handleDeleteRole(role.id)}
                  disabled={deletingRoleId === role.id}
                >
                  {locale === "nb" ? "Slett rolle" : "Delete role"}
                </button>
              </>
            )}
          </div>

          {!loadedRoleIds[role.id] ? (
            <div className="text-sm text-textColorThird">{locale === "nb" ? "Laster medlemmer..." : "Loading members..."}</div>
          ) : assignments.length === 0 ? (
            <div className="mb-3 text-sm text-textColorThird">
              {locale === "nb" ? "Ingen medlemmer i denne rollen" : "No members in this role"}
            </div>
          ) : (
            <div className="mb-3 flex flex-col gap-1">
              {assignments.map((assignment) => {
                const coworker = coworkerById.get(assignment.platformUserId);
                return (
                  <div key={assignment.platformUserId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-textcolor">{coworker?.username || coworker?.email || assignment.platformUserId}</span>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => void handleUnassign(role.id, assignment.platformUserId)}
                      disabled={unassigningUserId === assignment.platformUserId}
                    >
                      {locale === "nb" ? "Fjern" : "Remove"}
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
                {coworkers
                  .filter((c) => !assignments.some((a) => a.platformUserId === c.userId))
                  .map((coworker) => (
                    <option key={coworker.userId} value={coworker.userId}>
                      {coworker.username || coworker.email}
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
    <div>
      <h2 className="mb-1 text-[19px] font-bold text-textcolor">
        {locale === "nb" ? "Mappedelingsgrupper" : "Folder-sharing groups"}
      </h2>
      <p className="mb-6 max-w-xl text-sm text-textColorThird">
        {locale === "nb"
          ? "Opprett navngitte roller og tildel dem til flere kollegaer, slik at du kan dele mapper med hele rollen på en gang. Dette er adskilt fra Admin/Viewer-tilgangen over."
          : "Create named groups and assign multiple coworkers to them, so folders can be shared with the whole group at once. Separate from the Admin/Viewer access above."}
      </p>

      {rowError && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-3 px-4 text-sm font-medium text-red-600">{rowError}</div>
      )}

      <div className="customContainer mb-6 p-4">
        <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Ny rolle" : "New role"}</h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200] flex-1">
            <label className="block pb-2 text-sm">{locale === "nb" ? "Navn" : "Name"}</label>
            <input className="customInput w-full" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} type="text" disabled={creating} />
          </div>

          <button type="button" className="customButtonEnabled h-10 px-6" onClick={() => void handleCreateRole()} disabled={creating || !newRoleName.trim()}>
            {creating ? (locale === "nb" ? "Oppretter..." : "Creating...") : locale === "nb" ? "Opprett" : "Create"}
          </button>
        </div>

        {createError && <p className="mt-3 text-sm font-medium text-red-600">{createError}</p>}
      </div>

      {loading ? (
        <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
          {locale === "nb" ? "Laster roller..." : "Loading roles..."}
        </div>
      ) : error ? (
        <div className="customContainer flex items-center justify-center border-red-200! bg-red-50 py-10 text-sm font-medium text-red-600">{error}</div>
      ) : (
        <ExpandablePanelList
          items={panelItems}
          onToggle={handleTogglePanel}
          emptyMessage={locale === "nb" ? "Ingen roller opprettet" : "No roles created yet"}
        />
      )}
    </div>
  );
}
