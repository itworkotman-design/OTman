"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { hasFullAccess } from "@/lib/users/access";

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

export default function ArchiveRolesPage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const isFullAccess = currentUser ? hasFullAccess(currentUser.role) : true;

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

  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [assignmentsByRoleId, setAssignmentsByRoleId] = useState<Record<string, ArchiveRoleAssignmentRow[]>>({});
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
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
    if (!isFullAccess) return;
    void loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isFullAccess]);

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
    try {
      setAssignmentsLoading(true);

      const res = await fetch(`/api/archive/roles/${roleId}/assignments`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) return;

      setAssignmentsByRoleId((prev) => ({ ...prev, [roleId]: data.assignments ?? [] }));
    } finally {
      setAssignmentsLoading(false);
    }
  }

  function handleToggleRole(roleId: string) {
    const next = expandedRoleId === roleId ? null : roleId;
    setExpandedRoleId(next);

    if (next && !assignmentsByRoleId[next]) {
      void loadAssignments(next);
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

  if (currentUser && !isFullAccess) {
    return (
      <div className="w-full">
        <p className="text-textColorThird">
          {locale === "nb" ? "Du har ikke tilgang til denne siden." : "You do not have access to this page."}
        </p>
      </div>
    );
  }

  const coworkerById = new Map(coworkers.map((c) => [c.userId, c]));

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
            {locale === "nb" ? "Arkivroller" : "Archive roles"}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-textColorThird">
            {locale === "nb"
              ? "Opprett navngitte roller og tildel dem til flere kollegaer, slik at du kan dele mapper med hele rollen på en gang."
              : "Create named roles and assign multiple coworkers to them, so folders can be shared with the whole role at once."}
          </p>
        </div>

        <Link href="/dashboard/archive" className="text-sm text-textColorThird hover:underline">
          {locale === "nb" ? "Tilbake til arkiv" : "Back to archive"}
        </Link>
      </div>

      {rowError && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-3 px-4 text-sm font-medium text-red-600">
          {rowError}
        </div>
      )}

      <div className="customContainer mb-6 p-4">
        <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Ny rolle" : "New role"}</h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200] flex-1">
            <label className="block pb-2 text-sm">{locale === "nb" ? "Navn" : "Name"}</label>
            <input
              className="customInput w-full"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              type="text"
              disabled={creating}
            />
          </div>

          <button
            type="button"
            className="customButtonEnabled h-10 px-6"
            onClick={() => void handleCreateRole()}
            disabled={creating || !newRoleName.trim()}
          >
            {creating ? (locale === "nb" ? "Oppretter..." : "Creating...") : locale === "nb" ? "Opprett" : "Create"}
          </button>
        </div>

        {createError && <p className="mt-3 text-sm font-medium text-red-600">{createError}</p>}
      </div>

      <div className="min-w-0 w-full overflow-x-auto">
        {loading ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
            {locale === "nb" ? "Laster roller..." : "Loading roles..."}
          </div>
        ) : error ? (
          <div className="customContainer flex items-center justify-center border-red-200! bg-red-50 py-10 text-sm font-medium text-red-600">
            {error}
          </div>
        ) : roles.length === 0 ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
            {locale === "nb" ? "Ingen roller opprettet" : "No roles created yet"}
          </div>
        ) : (
          <div className="customContainer divide-y divide-lineSecondary">
            {roles.map((role) => {
              const isExpanded = expandedRoleId === role.id;
              const assignments = assignmentsByRoleId[role.id] ?? [];

              return (
                <div key={role.id} className="py-3 px-2">
                  <div className="flex w-full items-center justify-between gap-4">
                    {renamingRoleId === role.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          className="customInput flex-1"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          type="text"
                        />
                        <button
                          type="button"
                          className="customButtonEnabled shrink-0"
                          onClick={() => void handleRenameRole(role.id)}
                        >
                          {locale === "nb" ? "Lagre" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="customButtonDefault shrink-0"
                          onClick={() => setRenamingRoleId(null)}
                        >
                          {locale === "nb" ? "Avbryt" : "Cancel"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flex flex-1 items-center justify-between gap-4 text-left"
                        onClick={() => handleToggleRole(role.id)}
                      >
                        <span className="font-medium text-textcolor">{role.name}</span>
                        <span className="text-sm text-textColorThird">{isExpanded ? "▲" : "▼"}</span>
                      </button>
                    )}

                    {renamingRoleId !== role.id && (
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          className="text-sm text-textColorThird hover:underline"
                          onClick={() => startRename(role)}
                        >
                          {locale === "nb" ? "Endre navn" : "Rename"}
                        </button>
                        <button
                          type="button"
                          className="customButtonDefault"
                          onClick={() => void handleDeleteRole(role.id)}
                          disabled={deletingRoleId === role.id}
                        >
                          {locale === "nb" ? "Slett" : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pl-2">
                      {assignmentsLoading && !assignmentsByRoleId[role.id] ? (
                        <div className="text-sm text-textColorThird">
                          {locale === "nb" ? "Laster medlemmer..." : "Loading members..."}
                        </div>
                      ) : assignments.length === 0 ? (
                        <div className="text-sm text-textColorThird">
                          {locale === "nb" ? "Ingen medlemmer i denne rollen" : "No members in this role"}
                        </div>
                      ) : (
                        <div className="mb-3 flex flex-col gap-1">
                          {assignments.map((assignment) => {
                            const coworker = coworkerById.get(assignment.platformUserId);
                            return (
                              <div
                                key={assignment.platformUserId}
                                className="flex items-center justify-between gap-3 text-sm"
                              >
                                <span className="text-textcolor">
                                  {coworker?.username || coworker?.email || assignment.platformUserId}
                                </span>
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

                        <button
                          type="button"
                          className="customButtonEnabled h-10 px-6"
                          onClick={() => void handleAssign(role.id)}
                          disabled={assigning || !assignUserId}
                        >
                          {assigning
                            ? locale === "nb"
                              ? "Legger til..."
                              : "Adding..."
                            : locale === "nb"
                              ? "Legg til"
                              : "Add"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
