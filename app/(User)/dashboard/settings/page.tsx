"use client";

import { useCallback, useEffect, useState } from "react";
import PickupAddressModal, {
  type PickupAddressUser,
  type PickupAddressDetail,
  type PickupAddressFormData,
} from "@/app/_components/Dahsboard/pickupAddresses/PickupAddressModal";
import { ADDRESS_ICON_COMPONENTS } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import {
  ADDRESS_COLOR_CLASSES,
  DEFAULT_ADDRESS_COLOR,
  DEFAULT_ADDRESS_ICON,
  type AddressColorKey,
  type AddressIconKey,
} from "@/lib/pickupAddresses/addressAppearance";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { hasFullAccess } from "@/lib/users/access";

type PickupAddressRow = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  icon: AddressIconKey;
  color: AddressColorKey;
  isActive: boolean;
  users: PickupAddressUser[];
};

function userLabel(user: PickupAddressUser) {
  return user.username?.trim() || user.email;
}

function PickupAddressesSection() {
  const currentUser = useCurrentUser();
  const [rows, setRows] = useState<PickupAddressRow[]>([]);
  const [users, setUsers] = useState<PickupAddressUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PickupAddressDetail | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const canManage = Boolean(currentUser && hasFullAccess(currentUser.role));

  const loadPickupAddresses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/pickup-addresses", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.message || "Failed to load pickup addresses");
        return;
      }

      setRows(data.pickupAddresses ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/pickup-addresses/users", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (data?.ok) setUsers(data.users ?? []);
    } catch {
      // Leave the previous list in place — this only backs the modal's
      // "already main elsewhere" hints, not anything load-bearing.
    }
  }, []);

  useEffect(() => {
    loadPickupAddresses();
    loadUsers();
  }, [loadPickupAddresses, loadUsers]);

  const handleSave = async (data: PickupAddressFormData): Promise<string> => {
    const body = {
      name: data.name.trim(),
      address: data.address.trim(),
      phone: data.phone.trim() || null,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      icon: data.icon,
      color: data.color,
      userIds: data.userIds,
    };

    const res = await fetch(editing ? `/api/pickup-addresses/${editing.id}` : "/api/pickup-addresses", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      throw new Error(json?.message || "Failed to save pickup address");
    }

    const savedId = editing ? editing.id : json.pickupAddressId;

    setOpen(false);
    setEditing(null);
    await loadPickupAddresses();

    return savedId;
  };

  const handleToggleActive = async (row: PickupAddressRow) => {
    const action = row.isActive ? "deactivate" : "reactivate";

    if (row.isActive && !confirm(`Deactivate "${row.name}"? It will no longer be selectable for new orders or warehouse settings, but historical orders keep showing it.`)) {
      return;
    }

    setTogglingId(row.id);
    try {
      const res = await fetch(`/api/pickup-addresses/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        alert(json?.message || `Failed to ${action} pickup address`);
        return;
      }

      await loadPickupAddresses();
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <section>
      <PickupAddressModal
        isOpen={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        onUsersChanged={loadUsers}
        editing={editing}
        allUsers={users}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-extrabold text-logoblue">Pickup addresses</h2>
        <div className="flex-1" />
        {canManage && (
          <button
            type="button"
            className="rounded-full bg-logoblue px-5.5 py-2.5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(39,48,151,.25)] hover:opacity-90"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            + Add pickup address
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-6 text-textColorThird">Loading pickup addresses...</div>
      ) : error ? (
        <div className="py-6 text-red-600">{error}</div>
      ) : (
        <div className="mb-6 overflow-hidden rounded-[20px] border border-black/8">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/8 bg-black/3 text-left text-textColorSecond">
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">Name</th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">Address</th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">Latitude</th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">Longitude</th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">Users</th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">Status</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-textColorThird">
                    No pickup addresses yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const Icon = ADDRESS_ICON_COMPONENTS[row.icon] ?? ADDRESS_ICON_COMPONENTS[DEFAULT_ADDRESS_ICON];
                  const colorClasses = ADDRESS_COLOR_CLASSES[row.color] ?? ADDRESS_COLOR_CLASSES[DEFAULT_ADDRESS_COLOR];

                  return (
                  <tr key={row.id} className="border-b border-black/10 hover:bg-black/3">
                    <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                      <span className="flex items-center gap-2">
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${colorClasses.bg} ${colorClasses.text}`}>
                          <Icon />
                        </span>
                        {row.name}
                      </span>
                    </td>
                    <td className="border-r border-black/3 px-4 py-2 text-textColorThird">{row.address}</td>
                    <td className="border-r border-black/3 px-4 py-2 text-textColorThird">{row.latitude}</td>
                    <td className="border-r border-black/3 px-4 py-2 text-textColorThird">{row.longitude}</td>
                    <td className="border-r border-black/3 px-4 py-2 text-textColorThird">
                      {row.users.length === 0 ? "-" : row.users.map(userLabel).join(", ")}
                    </td>
                    <td className="border-r border-black/3 px-4 py-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          row.isActive ? "bg-emerald-100 text-emerald-800" : "bg-black/10 text-textColorThird"
                        }`}
                      >
                        {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {canManage && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="customButtonDefault text-sm"
                            onClick={() => {
                              setEditing(row);
                              setOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={togglingId === row.id}
                            className={`customButtonDefault text-sm ${
                              row.isActive ? "bg-red-600! text-white! hover:bg-red-700!" : ""
                            }`}
                            onClick={() => handleToggleActive(row)}
                          >
                            {togglingId === row.id ? "..." : row.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-w-0 max-w-1800">
      <h1 className="mb-8 whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
        Settings
      </h1>

      <PickupAddressesSection />
    </div>
  );
}
