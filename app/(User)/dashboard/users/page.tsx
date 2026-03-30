// app/(User)/dashboard/users/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import UserModal from "@/app/_components/Dahsboard/users/UserModal";
import { useRouter } from "next/navigation";
import type { Role, Membership } from "@/lib/users/types";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { getAccessLabel } from "@/lib/users/access";

export default function UserPage() {
  const currentUser = useCurrentUser();
  const currentUserRole = currentUser?.role ?? "USER";
  const [modalKey, setModalKey] = useState(0);
  const [users, setUsers] = useState<Membership[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Membership | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [priceLists, setPriceLists] = useState<{ id: string; name: string }[]>(
    [],
  );

  const router = useRouter();

  useEffect(() => {
    fetch("/api/products/pricelists")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setPriceLists(data.priceLists);
      });
  }, []);

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
        (u.user.username ?? "").toLowerCase().includes(q) ||
        u.user.email.toLowerCase().includes(q) ||
        (u.user.phoneNumber ?? "").toLowerCase().includes(q) ||
        (u.user.description ?? "").toLowerCase().includes(q) ||
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

    const res = await fetch(route, {
      method: "POST",
      credentials: "include",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      alert(data?.reason || "Failed to update user");
      return;
    }

    setSelectedUser((prev) =>
      prev
        ? {
            ...prev,
            status: prev.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
          }
        : prev,
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

  console.log("currentUser", currentUser);
  console.log("currentUserRole", currentUserRole);
  console.log("selectedUser", selectedUser);
  return (
    <div className="mx-auto max-w-[1500]">
      <h1 className="mb-20 whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
        User management
      </h1>

      <div className="w-full">
        <UserModal
          key={`${selectedUser?.id ?? "new"}-${modalKey}`}
          isOpen={open}
          onClose={() => {
            setOpen(false);
            setSelectedUser(null);
          }}
          actorRole={currentUserRole}
          targetRole={selectedUser?.role ?? "USER"}
          initialValueUsername={selectedUser?.user.username ?? ""}
          initialValueEmail={selectedUser?.user.email ?? ""}
          initialValuePhoneNumber={selectedUser?.user.phoneNumber ?? ""}
          initialValueDescription={selectedUser?.user.description ?? ""}
          initialValueRole={selectedUser?.role ?? "USER"}
          initialValueActive={
            selectedUser ? selectedUser.status === "ACTIVE" : true
          }
          initialValuePermissions={
            selectedUser?.permissions?.map((p) => p.permission) ?? [
              "BOOKING_VIEW",
            ]
          }
          priceLists={priceLists}
          initialPriceListId={selectedUser?.priceListId ?? null}
          onSave={async (data) => {
            console.log("CREATE USER MODAL DATA", data);
            if (!selectedUser) {
              const res = await fetch("/api/auth/invites/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  email: data.email,
                  role: data.role,
                  username: data.username,
                  phoneNumber: data.phoneNumber,
                  description: data.description,
                  priceListId: data.priceListId ?? null,
                  permissions: data.permissions,
                }),
              });

              const result = await res.json().catch(() => null);

              if (!res.ok || !result?.ok) {
                alert(result?.reason || "Failed to create invite");
                return;
              }

              await loadUsers();
              setOpen(false);
              return;
            }

            const profileRes = await fetch(
              `/api/auth/memberships/${selectedUser.id}/update`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  email: data.email,
                  username: data.username,
                  phoneNumber: data.phoneNumber,
                  description: data.description,
                  priceListId: data.priceListId ?? null,
                  permissions: data.permissions,
                }),
              },
            );

            const profileResult = await profileRes.json().catch(() => null);

            if (!profileRes.ok || !profileResult?.ok) {
              alert(profileResult?.reason || "Failed to update user");
              return;
            }

            if (selectedUser.role !== data.role) {
              await changeRole(selectedUser, data.role as Role);
              return;
            }

            await loadUsers();
            router.refresh();
            setOpen(false);
            setSelectedUser(null);
          }}
          onRemove={async () => {
            if (!selectedUser) return false;

            const res = await fetch(
              `/api/auth/memberships/${selectedUser.id}/remove`,
              {
                method: "POST",
                credentials: "include",
              },
            );

            const result = await res.json().catch(() => null);

            if (!res.ok || !result?.ok) {
              alert(result?.reason || "Failed to remove user");
              return false;
            }

            await loadUsers();
            router.refresh();
            setOpen(false);
            setSelectedUser(null);
            return true;
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
              onClick={() => {
                setSelectedUser(null);
                setModalKey((prev) => prev + 1);
                setOpen(true);
              }}
            >
              Add User
            </button>

            <button
              className="customButtonDefault hidden hover:bg-black/3! lg:block"
              disabled
            >
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
                          setSelectedIds((prev) =>
                            Array.from(new Set([...prev, ...visibleIds])),
                          );
                        } else {
                          setSelectedIds((prev) =>
                            prev.filter((id) => !visibleIds.includes(id)),
                          );
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label="Select all"
                    />
                  </th>

                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                    Username
                  </th>
                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                    Email
                  </th>
                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                    Number
                  </th>
                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                    Description
                  </th>
                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                    Role
                  </th>
                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                    Price List
                  </th>
                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                    Access
                  </th>
                  <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                    Created
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">
                    Active
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="cursor-pointer border-b border-black/10 hover:bg-black/2"
                    onClick={() => {
                      setSelectedUser(u);
                      setModalKey((prev) => prev + 1);
                      setOpen(true);
                    }}
                  >
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        onChange={(e) => {
                          setSelectedIds((prev) =>
                            e.target.checked
                              ? [...prev, u.id]
                              : prev.filter((id) => id !== u.id),
                          );
                        }}
                        checked={selectedIds.includes(u.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select user ${u.id}`}
                      />
                    </td>

                    <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                      {u.user.username || "-"}
                    </td>
                    <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                      {u.user.email}
                    </td>
                    <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                      {u.user.phoneNumber || "-"}
                    </td>
                    <td className="max-w-[220] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                      {u.user.description || "-"}
                    </td>
                    <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                      {u.role}
                    </td>
                    <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                      {priceLists.find((pl) => pl.id === u.priceListId)?.name ||
                        "-"}
                    </td>
                    <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                      {getAccessLabel(
                        u.role,
                        u.permissions?.map((p) => p.permission) ?? [],
                      ) || "-"}
                    </td>
                    <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td
                      className={`px-4 py-2 font-semibold text-textColorThird ${
                        u.status !== "ACTIVE" ? "text-red-600" : ""
                      }`}
                    >
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
