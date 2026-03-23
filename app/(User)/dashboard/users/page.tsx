"use client";

import { useEffect, useMemo, useState } from "react";
import UserModal from "@/app/_components/Dahsboard/users/UserModal";
import { useRouter } from "next/navigation";
import type { Role, Membership } from "@/lib/users/types";
import { useCurrentUser } from "@/lib/users/useCurrentUser";

export default function UserPage() {
  const currentUser = useCurrentUser();
  const currentUserRole = currentUser?.role ?? "USER";

  const [users, setUsers] = useState<Membership[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Membership | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const router = useRouter();

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/auth/memberships", {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to load users");
        return;
      }

      setUsers(data.memberships);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const roleOk = !roleFilter || u.role === roleFilter;
      const q = query.trim().toLowerCase();
      const queryOk =
        !q ||
        u.user.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q);
      return roleOk && queryOk;
    });
  }, [users, roleFilter, query]);

  const visibleIds = filteredUsers.map((u) => u.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  async function toggleMembership(target: Membership) {
    const route =
      target.status === "ACTIVE"
        ? `/api/auth/memberships/${target.id}/disable`
        : `/api/auth/memberships/${target.id}/enable`;

    const res = await fetch(route, { method: "POST", credentials: "include" });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      alert(data?.reason || "Failed to update user");
      return;
    }

    setSelectedUser((prev) =>
      prev ? { ...prev, status: prev.status === "ACTIVE" ? "DISABLED" : "ACTIVE" } : prev
    );

    await loadUsers();
    router.refresh();
    setOpen(false);
    setSelectedUser(null);
  }

  async function changeRole(target: Membership, nextRole: Role) {
    const res = await fetch(`/api/auth/memberships/${target.id}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role: nextRole }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      alert(data?.reason || "Failed to change role");
      return;
    }

    setSelectedUser((prev) => (prev ? { ...prev, role: nextRole } : prev));

    await loadUsers();
    router.refresh();
    setOpen(false);
    setSelectedUser(null);
  }

  return (
    <div className="mx-auto max-w-[1500]">
      <h1 className="mb-20 whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
        User management
      </h1>

      <div className="w-full">
        <UserModal
          key={selectedUser?.id ?? "new"}
          isOpen={open}
          onClose={() => setOpen(false)}
          actorRole={currentUserRole}
          targetRole={selectedUser?.role ?? "USER"}
          initialValueName={selectedUser?.user.email ?? ""}
          initialValueEmail={selectedUser?.user.email ?? ""}
          initialValueNumber={0}
          initialValueRole={selectedUser?.role ?? "USER"}
          initialValueActive={selectedUser ? selectedUser.status === "ACTIVE" : true}
          onSave={async (data) => {
            if (!selectedUser) {
              const res = await fetch("/api/auth/invites/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email: data.email, role: data.role }),
              });

              const result = await res.json().catch(() => null);

              if (!res.ok || !result?.ok) {
                alert(result?.reason || "Failed to create invite");
                return;
              }

              await loadUsers();
              return;
            }

            changeRole(selectedUser, data.role as Role);
          }}
          onRemove={() => {
            if (!selectedUser) return;
            alert("Remove user is not connected to backend yet.");
          }}
          onToggleActive={() => {
            if (!selectedUser) return;
            toggleMembership(selectedUser);
          }}
        />

        <div className="shadow-xs flex pb-2">
          <div className="whitespace-nowrap">
            <select
              className="customInput mr-2 cursor-pointer duration-200 hover:bg-black/3"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">Role</option>
              <option value="OWNER">Owner</option>
              <option value="ADMIN">Admin</option>
              <option value="USER">User</option>
            </select>

            <input
              className="customInput w-60"
              placeholder="Search email, role, id"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="ml-auto flex gap-2">
            <button
              className="customButtonDefault"
              onClick={() => { setSelectedUser(null); setOpen(true); }}
            >
              Add User
            </button>
            <button className="customButtonDefault hidden hover:bg-black/3! lg:block">
              Export
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-6 text-textColorThird">Loading users...</div>
        ) : error ? (
          <div className="py-6 text-red-600">{error}</div>
        ) : (
          <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="w-full border-y border-black/10">
              <thead>
                <tr className="border-y border-black/10 bg-black/3 text-left text-textColorSecond">
                  <th className="table-cell whitespace-nowrap border-r border-black/3 px-1 py-3 text-center font-medium">
                    <input
                      checked={allVisibleSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
                        } else {
                          setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">User</th>
                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">Email</th>
                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">Role</th>
                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">Membership</th>
                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">User status</th>
                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">Created</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="cursor-pointer border-b border-black/10 hover:bg-black/2"
                    onClick={() => { setSelectedUser(u); setOpen(true); }}
                  >
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        onChange={(e) => {
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                          );
                        }}
                        checked={selectedIds.includes(u.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select user ${u.id}`}
                      />
                    </td>
                    <td className="flex items-center whitespace-nowrap border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">{u.user.email}</td>
                    <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">{u.user.email}</td>
                    <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">{u.role}</td>
                    <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">{u.status}</td>
                    <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">{u.user.status}</td>
                    <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className={`px-4 py-2 font-semibold text-textColorThird ${u.status !== "ACTIVE" ? "text-red-600" : ""}`}>
                      {u.status === "ACTIVE" ? "Active" : "Disabled"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}