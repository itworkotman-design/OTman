// app/(User)/dashboard/users/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UserModal from "@/app/_components/Dahsboard/users/UserModal";
import { AppsRolesTab } from "@/app/_components/Dahsboard/users/AppsRolesTab";
import { useRouter } from "next/navigation";
import type { AppModule, Role, Membership, PendingInvite } from "@/lib/users/types";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { ALL_MODULES, MODULE_LABELS } from "@/lib/users/appAccessDefaults";
import { getModuleAccess } from "@/lib/users/access";
import { canManageTarget } from "@/lib/users/userModal";
import { getUserLogoDisplayPath } from "@/lib/users/profileAppearance";
import {
  normalizedIncludes,
  normalizeSearchText,
} from "@/lib/searchNormalization";

const ROLE_PRIORITY: Record<Role, number> = {
  OWNER: 0,
  ADMIN: 1,
  USER: 2,
};

const MODULE_BADGE_LABELS: Record<AppModule, string> = {
  ARCHIVE: "AR",
  BOOKING: "BK",
  WEBSITE_EDITOR: "WE",
  WEBSITE_ORDERS: "WO",
  SCHEDULER: "SC",
  USER_MANAGEMENT: "UM",
};

const APP_ICON_STACK_LIMIT = 3;

function getInitial(u: Membership): string {
  const label = u.user.username || u.user.email || "?";
  return label.trim().charAt(0).toUpperCase() || "?";
}

function MemberAvatar({ membership }: { membership: Membership }) {
  const logoDisplayPath = getUserLogoDisplayPath(membership.user.logoPath);
  const bgColor = membership.user.usernameDisplayColor || "#273097";

  if (logoDisplayPath) {
    return (
      <div className="grid h-9.5 w-9.5 shrink-0 place-items-center overflow-hidden rounded-full bg-black/5 p-1">
        <img src={logoDisplayPath} alt="" className="h-full w-full object-contain" />
      </div>
    );
  }

  return (
    <span
      className="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
      style={{ backgroundColor: bgColor }}
    >
      {getInitial(membership)}
    </span>
  );
}

function AppAccessBadges({ appAccess }: { appAccess: Membership["appAccess"] }) {
  const enabledModules = appAccess.filter((row) => row.enabled);
  const stack = enabledModules.slice(0, APP_ICON_STACK_LIMIT);
  const overflow = enabledModules.length - stack.length;
  const tooltip = enabledModules
    .map((row) => `${MODULE_LABELS[row.module]}: ${row.level === "ADMIN" ? "Admin" : "Viewer"}`)
    .join(", ");
  const countLabel =
    enabledModules.length === 0
      ? "No apps"
      : `${enabledModules.length} app${enabledModules.length === 1 ? "" : "s"}`;

  return (
    <div className="flex items-center gap-2.5" title={tooltip || undefined}>
      <div className="flex">
        {stack.map((row) => (
          <span
            key={row.module}
            className="ml-[-8px] grid h-[26px] w-[26px] place-items-center rounded-full border-2 border-white bg-logoblue text-[10.5px] font-bold text-white first:ml-0"
          >
            {MODULE_BADGE_LABELS[row.module]}
          </span>
        ))}
        {overflow > 0 && (
          <span className="ml-[-8px] grid h-[26px] w-[26px] place-items-center rounded-full border-2 border-white bg-black/10 text-[10.5px] font-bold text-textColorThird">
            +{overflow}
          </span>
        )}
      </div>
      <span className="whitespace-nowrap text-[12.5px] text-textColorThird">{countLabel}</span>
    </div>
  );
}

function getMemberStatus(u: Membership): { color: string; label: string } {
  if (u.status !== "ACTIVE") return { color: "#c0392b", label: "Disabled" };
  if (u.isOnline) return { color: "#2e9e6b", label: "Online" };
  return { color: "#a3a3a3", label: "Offline" };
}

function formatLastSeen(lastSeenAt: string | null | undefined, isOnline: boolean): string {
  if (isOnline) return "Online";
  if (!lastSeenAt) return "Never";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `${days}d ago`;
  return new Date(lastSeenAt).toLocaleDateString();
}

type PageTab = "USERS" | "APPS_ROLES";

export default function UserPage() {
  const currentUser = useCurrentUser();
  const isOwner = currentUser?.role === "OWNER";
  // Fail closed while currentUser is still loading — unlike Sidebar's
  // fail-open pattern, granting Admin-tier controls for a moment before the
  // real check lands would let someone click "+ Add user" or a role select
  // that's about to disappear underneath them.
  const isUmAdmin = isOwner || (!!currentUser && getModuleAccess(currentUser, "USER_MANAGEMENT").level === "ADMIN");
  const isNonOwnerUmAdmin = isUmAdmin && !isOwner;
  const [activeTab, setActiveTab] = useState<PageTab>("USERS");
  const [modalKey, setModalKey] = useState(0);
  const [users, setUsers] = useState<Membership[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Membership | null>(null);
  const [appFilter, setAppFilter] = useState<AppModule | "">("");
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [priceLists, setPriceLists] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const router = useRouter();

  const uploadUserLogo = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/auth/users/logo", {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok || typeof data.logoPath !== "string") {
      throw new Error(data?.reason || "Failed to upload logo");
    }

    return data.logoPath;
  }, []);

  useEffect(() => {
    fetch("/api/products/pricelists")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setPriceLists(data.priceLists);
      });
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [membershipsRes, invitesRes] = await Promise.all([
        fetch("/api/auth/memberships", { method: "GET", credentials: "include" }),
        fetch("/api/auth/invites", { method: "GET", credentials: "include" }),
      ]);

      const [membershipsData, invitesData] = await Promise.all([
        membershipsRes.json().catch(() => null),
        invitesRes.json().catch(() => null),
      ]);

      if (!membershipsRes.ok || !membershipsData?.ok) {
        setError(membershipsData?.reason || "Failed to load users");
        return;
      }

      setUsers(membershipsData.memberships);
      if (invitesRes.ok && invitesData?.ok) {
        setPendingInvites(invitesData.invites);
      }
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const refreshPresence = () => {
      if (open) return;
      if (document.visibilityState !== "visible") return;
      void loadUsers();
    };

    const intervalId = window.setInterval(refreshPresence, 300_000);
    document.addEventListener("visibilitychange", refreshPresence);
    window.addEventListener("focus", refreshPresence);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshPresence);
      window.removeEventListener("focus", refreshPresence);
    };
  }, [loadUsers, open]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);

    return users
      .filter((u) => {
        const appOk = !appFilter || u.appAccess?.some((a) => a.module === appFilter && a.enabled);
        const queryOk =
          !normalizedQuery ||
          normalizedIncludes(u.user.username, normalizedQuery) ||
          normalizedIncludes(u.user.email, normalizedQuery) ||
          normalizedIncludes(u.user.phoneNumber, normalizedQuery) ||
          normalizedIncludes(u.user.address, normalizedQuery) ||
          normalizedIncludes(u.user.description, normalizedQuery) ||
          normalizedIncludes(u.role, normalizedQuery) ||
          normalizedIncludes(u.id, normalizedQuery);

        return appOk && queryOk;
      })
      .toSorted((a, b) => {
        const onlinePriorityA = a.isOnline ? 0 : 1;
        const onlinePriorityB = b.isOnline ? 0 : 1;
        if (onlinePriorityA !== onlinePriorityB) return onlinePriorityA - onlinePriorityB;

        const statusPriorityA = a.status === "ACTIVE" ? 0 : 1;
        const statusPriorityB = b.status === "ACTIVE" ? 0 : 1;
        if (statusPriorityA !== statusPriorityB) return statusPriorityA - statusPriorityB;

        const rolePriorityA = ROLE_PRIORITY[a.role] ?? 99;
        const rolePriorityB = ROLE_PRIORITY[b.role] ?? 99;
        if (rolePriorityA !== rolePriorityB) return rolePriorityA - rolePriorityB;

        const labelA = (a.user.username || a.user.email).toLowerCase();
        const labelB = (b.user.username || b.user.email).toLowerCase();
        return labelA.localeCompare(labelB);
      });
  }, [users, appFilter, query]);

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

  async function revokeInvite(inviteId: string) {
    setRevokingId(inviteId);
    try {
      const res = await fetch(`/api/auth/invites/${inviteId}/revoke`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        alert(data?.reason || "Failed to revoke invite");
        return;
      }
      await loadUsers();
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="min-w-0 max-w-1800">
      <h1 className="mb-8 whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
        User management
      </h1>

      <div className="mb-12 flex gap-2 border-b border-lineSecondary">
        {(
          [
            { id: "USERS" as const, label: "Users" },
            ...(isUmAdmin ? [{ id: "APPS_ROLES" as const, label: "Apps & roles" }] : []),
          ]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-logoblue text-logoblue"
                : "border-transparent text-textColorThird hover:text-textColorSecond"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isUmAdmin && activeTab === "APPS_ROLES" && <AppsRolesTab memberships={users} />}

    {activeTab === "USERS" && (
    <div className="mx-auto min-w-0 w-full max-w-1800">
        <UserModal
          key={`${selectedUser?.id ?? "new"}-${modalKey}`}
          isOpen={open}
          formResetKey={`${selectedUser?.id ?? "new"}-${modalKey}`}
          onClose={() => {
            setOpen(false);
            setSelectedUser(null);
          }}
          isOwner={isOwner}
          isUmAdmin={isUmAdmin}
          targetRole={selectedUser?.role ?? "USER"}
          initialValueUsername={selectedUser?.user.username ?? ""}
          initialValueEmail={selectedUser?.user.email ?? ""}
          initialValueWarehouseEmail={selectedUser?.warehouseEmail ?? ""}
          initialValuePhoneNumber={selectedUser?.user.phoneNumber ?? ""}
          initialValueAddress={selectedUser?.user.address ?? ""}
          initialValueDescription={selectedUser?.user.description ?? ""}
          initialValueLogoPath={selectedUser?.user.logoPath ?? null}
          initialValueUsernameDisplayColor={
            selectedUser?.user.usernameDisplayColor ?? null
          }
          initialValueRole={selectedUser?.role ?? "USER"}
          initialValueActive={
            selectedUser ? selectedUser.status === "ACTIVE" : true
          }
          initialValueAppAccess={selectedUser?.appAccess}
          priceLists={priceLists}
          initialPriceListIds={selectedUser?.priceListIds ?? []}
          onSave={async (data) => {
            let logoPath = data.logoPath;

            if (data.logoFile) {
              try {
                logoPath = await uploadUserLogo(data.logoFile);
              } catch (error) {
                alert(
                  error instanceof Error
                    ? error.message
                    : "Failed to upload logo",
                );
                return;
              }
            }

            if (!selectedUser) {
              const endpoint =
                data.provisionMode === "INVITE"
                  ? "/api/auth/invites/create"
                  : "/api/auth/users/create";
              const body =
                data.provisionMode === "INVITE"
                  ? {
                      email: data.email,
                      warehouseEmail: data.warehouseEmail,
                      role: data.role,
                      username: data.username,
                      phoneNumber: data.phoneNumber,
                      address: data.address,
                      description: data.description,
                      logoPath,
                      usernameDisplayColor: data.usernameDisplayColor || null,
                      priceListId: data.priceListIds[0] ?? null,
                      appAccess: data.appAccess,
                    }
                  : {
                      email: data.email,
                      warehouseEmail: data.warehouseEmail,
                      role: data.role,
                      username: data.username,
                      phoneNumber: data.phoneNumber,
                      address: data.address,
                      description: data.description,
                      logoPath,
                      usernameDisplayColor: data.usernameDisplayColor || null,
                      priceListIds: data.priceListIds,
                      appAccess: data.appAccess,
                      password: data.password,
                      confirmPassword: data.confirmPassword,
                    };

              const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body),
              });

              const result = await res.json().catch(() => null);

              if (!res.ok || !result?.ok) {
                alert(
                  result?.reason ||
                    (data.provisionMode === "INVITE"
                      ? "Failed to create invite"
                      : "Failed to create user"),
                );
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
                  warehouseEmail: data.warehouseEmail,
                  username: data.username,
                  phoneNumber: data.phoneNumber,
                  address: data.address,
                  description: data.description,
                  logoPath,
                  usernameDisplayColor: data.usernameDisplayColor || null,
                  priceListIds: data.priceListIds,
                }),
              },
            );

            const profileResult = await profileRes.json().catch(() => null);

            if (!profileRes.ok || !profileResult?.ok) {
              alert(profileResult?.reason || "Failed to update user");
              return;
            }

            const appAccessRes = await fetch(
              `/api/auth/memberships/${selectedUser.id}/app-access`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ appAccess: data.appAccess }),
              },
            );

            const appAccessResult = await appAccessRes.json().catch(() => null);

            if (!appAccessRes.ok || !appAccessResult?.ok) {
              alert(appAccessResult?.reason || "Failed to update access");
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
          onToggleActive={() => {
            if (!selectedUser) return;
            toggleMembership(selectedUser);
          }}
        />

        <div className="min-w-0 w-full">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              className="min-w-[170] cursor-pointer rounded-full border border-black/10 px-4 py-2 text-[13.5px] font-semibold text-textcolor"
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value as AppModule | "")}
            >
              <option value="">All apps</option>
              {ALL_MODULES.map((module) => (
                <option key={module} value={module}>
                  {MODULE_LABELS[module]}
                </option>
              ))}
            </select>

            <input
              className="min-w-[220] max-w-90 flex-1 rounded-full border border-black/10 px-4 py-2 text-[13.5px]"
              placeholder="Search name, email, id"
              type="search"
              name="membership-search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div className="flex-1" />

            <button
              type="button"
              className="rounded-full border border-black/10 bg-white px-4.5 py-2 text-[13px] font-semibold text-textColorSecond hover:bg-black/3"
              disabled
            >
              Export
            </button>

            {isUmAdmin && (
              <button
                type="button"
                className="rounded-full bg-logoblue px-5.5 py-2.5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(39,48,151,.25)] hover:opacity-90"
                onClick={() => {
                  setSelectedUser(null);
                  setModalKey((prev) => prev + 1);
                  setOpen(true);
                }}
              >
                + Add user
              </button>
            )}
          </div>

          <div className="min-w-0 w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <div className="w-full">
            {!loading && !error && pendingInvites.length > 0 && (
              <div className="mb-6 overflow-hidden rounded-[20px] border border-black/8">
                <h2 className="border-b border-black/8 bg-amber-500/10 px-5 py-3 text-sm font-bold text-textColorSecond">
                  Pending Invitations ({pendingInvites.length})
                </h2>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-black/8 bg-amber-500/10 text-left text-textColorSecond">
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
                        Invited
                      </th>
                      <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                        Expires
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvites.map((invite) => (
                      <tr
                        key={invite.id}
                        className="border-b border-black/10 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                      >
                        <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                          {invite.username || "-"}
                        </td>
                        <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                          {invite.email}
                        </td>
                        <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                          {invite.phoneNumber || "-"}
                        </td>
                        <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                          <div className="max-w-[220] truncate">
                            {invite.description || "-"}
                          </div>
                        </td>
                        <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                          {invite.role}
                        </td>
                        <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                          {new Date(invite.createdAt).toLocaleDateString()}
                        </td>
                        <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                          {new Date(invite.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            className="customButtonDefault text-sm bg-red-600! text-white! hover:bg-red-700!"
                            disabled={revokingId === invite.id}
                            onClick={() => revokeInvite(invite.id)}
                          >
                            {revokingId === invite.id ? "Revoking..." : "Revoke"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {loading ? (
              <div className="py-6 text-textColorThird">Loading users...</div>
            ) : error ? (
              <div className="py-6 text-red-600">{error}</div>
            ) : (
              <div className="overflow-hidden rounded-[20px] border border-black/8">
                <div className="grid grid-cols-[minmax(min-content,1.8fr)_minmax(min-content,1.6fr)_minmax(min-content,1fr)_minmax(min-content,1fr)_auto] gap-3 bg-logoblue/4 px-5 py-3.5 text-xs font-bold tracking-wide text-logoblue uppercase">
                  <div className="whitespace-nowrap px-2">User</div>
                  <div className="whitespace-nowrap px-2">Apps</div>
                  <div className="whitespace-nowrap px-2">Last seen</div>
                  <div className="whitespace-nowrap px-2">Status</div>
                  <div />
                </div>

                {filteredUsers.map((u) => {
                  const status = getMemberStatus(u);

                  return (
                    <div
                      key={u.id}
                      className="grid grid-cols-[minmax(min-content,1.8fr)_minmax(min-content,1.6fr)_minmax(min-content,1fr)_minmax(min-content,1fr)_auto] items-center gap-3 border-t border-black/6 px-5 py-4"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 cursor-pointer items-center gap-3 px-2 text-left"
                        onClick={() => {
                          setSelectedUser(u);
                          setOpen(true);
                        }}
                      >
                        <MemberAvatar membership={u} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-textcolor">{u.user.username || "-"}</div>
                          <div className="truncate text-[12.5px] text-textColorThird">{u.user.email}</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="flex min-w-0 cursor-pointer items-center px-2 text-left"
                        onClick={() => {
                          setSelectedUser(u);
                          setOpen(true);
                        }}
                      >
                        <AppAccessBadges appAccess={u.appAccess ?? []} />
                      </button>

                      <div className="whitespace-nowrap px-2 text-[13px] text-textColorSecond">
                        {formatLastSeen(u.lastSeenAt, !!u.isOnline)}
                      </div>

                      <div className="flex items-center gap-1.5 whitespace-nowrap px-2 text-[13px] font-semibold" style={{ color: status.color }}>
                        <span className="h-1.75 w-1.75 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
                        {status.label}
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded-full text-lg leading-none text-textColorThird hover:bg-black/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId((prev) => (prev === u.id ? null : u.id));
                          }}
                          aria-label={`Actions for ${u.user.username || u.user.email}`}
                        >
                          ⋮
                        </button>

                        {openMenuId === u.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                              }}
                            />
                            <div
                              className="absolute right-0 top-9 z-20 w-47.5 rounded-xl border border-black/10 bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,.14)]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-textcolor hover:bg-black/5"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setSelectedUser(u);
                                  setOpen(true);
                                }}
                              >
                                Edit user
                              </button>
                              {canManageTarget(isOwner, isNonOwnerUmAdmin, u.role) && (
                              <button
                                type="button"
                                className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-textcolor hover:bg-black/5"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  if (
                                    !confirm(
                                      u.status === "ACTIVE" ? "Disable this user?" : "Enable this user?",
                                    )
                                  ) {
                                    return;
                                  }
                                  void toggleMembership(u);
                                }}
                              >
                                {u.status === "ACTIVE" ? "Disable user" : "Enable user"}
                              </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <div className="px-5 py-10 text-center text-sm text-textColorThird">No users match your filters.</div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
