"use client";

import { useEffect, useState } from "react";
import { ADDRESS_ICON_COMPONENTS } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import {
  ADDRESS_COLOR_CLASSES,
  ADDRESS_COLOR_KEYS,
  ADDRESS_ICON_KEYS,
  DEFAULT_ADDRESS_COLOR,
  DEFAULT_ADDRESS_ICON,
  type AddressColorKey,
  type AddressIconKey,
} from "@/lib/pickupAddresses/addressAppearance";

export type PickupAddressUser = {
  id: string;
  email: string;
  username: string | null;
  mainPickupAddress?: { id: string; name: string } | null;
};

export type PickupAddressFormData = {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  icon: AddressIconKey;
  color: AddressColorKey;
  userIds: string[];
};

export type PickupAddressDetail = {
  id: string;
  name: string;
  address: string;
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

// Finds every user whose pending "main" nomination would silently steal
// them from a different pickup address — surfaces all of them (not just
// the first) so an admin nominating several people at once sees the whole
// picture before confirming.
function getMainReassignmentConflicts(
  allUsers: PickupAddressUser[],
  pendingMainUserIds: Set<string>,
  currentAddressId: string | null,
): { userId: string; label: string; existingAddressName: string }[] {
  return allUsers
    .filter((user) => pendingMainUserIds.has(user.id))
    .filter((user) => user.mainPickupAddress && user.mainPickupAddress.id !== currentAddressId)
    .map((user) => ({
      userId: user.id,
      label: userLabel(user),
      existingAddressName: user.mainPickupAddress!.name,
    }));
}

export default function PickupAddressModal({
  isOpen,
  onClose,
  onSave,
  onUsersChanged,
  editing,
  allUsers,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PickupAddressFormData) => Promise<string>;
  onUsersChanged?: () => void;
  editing: PickupAddressDetail | null;
  allUsers: PickupAddressUser[];
}) {
  const isCreateMode = !editing;
  const [form, setForm] = useState<PickupAddressFormData>({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    icon: DEFAULT_ADDRESS_ICON,
    color: DEFAULT_ADDRESS_COLOR,
    userIds: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingMainUserIds, setPendingMainUserIds] = useState<Set<string>>(new Set());
  const [initialMainUserIds, setInitialMainUserIds] = useState<Set<string>>(new Set());
  const [mainConflicts, setMainConflicts] = useState<
    { userId: string; label: string; existingAddressName: string }[] | null
  >(null);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setForm({
      name: editing?.name ?? "",
      address: editing?.address ?? "",
      latitude: editing ? String(editing.latitude) : "",
      longitude: editing ? String(editing.longitude) : "",
      icon: editing?.icon ?? DEFAULT_ADDRESS_ICON,
      color: editing?.color ?? DEFAULT_ADDRESS_COLOR,
      userIds: editing?.users.map((u) => u.id) ?? [],
    });

    const currentMainUserIds = new Set(
      editing ? allUsers.filter((u) => u.mainPickupAddress?.id === editing.id).map((u) => u.id) : [],
    );
    setPendingMainUserIds(currentMainUserIds);
    setInitialMainUserIds(currentMainUserIds);
    setMainConflicts(null);
  }, [isOpen, editing, allUsers]);

  if (!isOpen) return null;

  const eligibleUsers = allUsers.filter((user) => form.userIds.includes(user.id));

  const toggleUser = (id: string) => {
    setForm((prev) => ({
      ...prev,
      userIds: prev.userIds.includes(id)
        ? prev.userIds.filter((u) => u !== id)
        : [...prev.userIds, id],
    }));
    setMainConflicts(null);
  };

  // Purely local until submit — the actual add/remove PATCH only fires from
  // handleSubmit, once the address itself (new or edited) exists server-side.
  const toggleMainUser = (userId: string) => {
    setPendingMainUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    setMainConflicts(null);
  };

  const handleSubmit = async () => {
    setError(null);

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!form.address.trim()) {
      setError("Address is required.");
      return;
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setError("Latitude must be a number between -90 and 90.");
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError("Longitude must be a number between -180 and 180.");
      return;
    }

    if (mainConflicts === null) {
      const conflicts = getMainReassignmentConflicts(allUsers, pendingMainUserIds, editing?.id ?? null);

      if (conflicts.length > 0) {
        setMainConflicts(conflicts);
        return;
      }
    }

    setSaving(true);
    try {
      const savedId = await onSave(form);

      const addUserIds = [...pendingMainUserIds].filter((id) => !initialMainUserIds.has(id));
      const removeUserIds = [...initialMainUserIds].filter((id) => !pendingMainUserIds.has(id));

      if (addUserIds.length > 0 || removeUserIds.length > 0) {
        const res = await fetch(`/api/pickup-addresses/${savedId}/assign-users`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ addUserIds, removeUserIds }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || "Failed to update main pickup address assignment");
        }
      }

      // The parent's cached user list (mainPickupAddress per user) is now
      // stale — refresh it so re-opening this modal reflects the change
      // without a manual page reload.
      onUsersChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pickup address");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-[640] overflow-y-auto rounded-3xl bg-white p-9 shadow-[0_20px_60px_rgba(0,0,0,.25)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-8 top-7 grid h-8.5 w-8.5 cursor-pointer place-items-center rounded-full bg-logoblue text-white"
        >
          ✕
        </button>

        <h1 className="mb-6 text-center text-[26px] font-extrabold text-logoblue">
          {isCreateMode ? "Add pickup address" : "Edit pickup address"}
        </h1>

        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block pb-1.5 text-sm font-semibold text-textcolor">Name</label>
            <input
              className="customInput w-full"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Power Storo"
            />
          </div>

          <div>
            <label className="block pb-1.5 text-sm font-semibold text-textcolor">Address</label>
            <input
              className="customInput w-full"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Human-readable street address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block pb-1.5 text-sm font-semibold text-textcolor">Latitude</label>
              <input
                className="customInput w-full"
                value={form.latitude}
                onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))}
                placeholder="59.945"
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="block pb-1.5 text-sm font-semibold text-textcolor">Longitude</label>
              <input
                className="customInput w-full"
                value={form.longitude}
                onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))}
                placeholder="10.7669"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block pb-1.5 text-sm font-semibold text-textcolor">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ADDRESS_ICON_KEYS.map((key) => {
                  const Icon = ADDRESS_ICON_COMPONENTS[key];
                  const colorClasses = ADDRESS_COLOR_CLASSES[form.color];
                  const isSelected = form.icon === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={key}
                      aria-pressed={isSelected}
                      onClick={() => setForm((prev) => ({ ...prev, icon: key }))}
                      className={`grid h-10 w-10 place-items-center rounded-lg border transition-colors ${
                        isSelected
                          ? `border-transparent ${colorClasses.bg} ${colorClasses.text}`
                          : "border-black/10 text-textColorThird hover:border-black/20"
                      }`}
                    >
                      <Icon />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block pb-1.5 text-sm font-semibold text-textcolor">Color</label>
              <div className="flex flex-wrap gap-2">
                {ADDRESS_COLOR_KEYS.map((key) => {
                  const isSelected = form.color === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={key}
                      aria-pressed={isSelected}
                      onClick={() => setForm((prev) => ({ ...prev, color: key }))}
                      className={`h-10 w-10 rounded-lg border-2 transition-transform ${
                        isSelected ? "scale-105 border-black/60" : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: ADDRESS_COLOR_CLASSES[key].swatch }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="block pb-1.5 text-sm font-semibold text-textcolor">Visible to users</label>
            <div className="flex flex-wrap gap-2 rounded-xl border border-black/8 p-3">
              {allUsers.length === 0 ? (
                <span className="text-sm text-textColorThird">No users found.</span>
              ) : (
                allUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.userIds.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                    />
                    {userLabel(user)}
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block pb-1.5 text-sm font-semibold text-textcolor">
              Main pickup address for these users
            </label>
            <p className="mb-2 text-xs text-textColorThird">
              Only users given visibility above are eligible. Applied when you{" "}
              {isCreateMode ? "create" : "save"} this address — a user&apos;s warehouse address field
              becomes read-only once selected here.
            </p>
            <div className="flex flex-wrap gap-2 rounded-xl border border-black/8 p-3">
              {eligibleUsers.length === 0 ? (
                <span className="text-sm text-textColorThird">
                  No eligible users — give this address visibility to a user first.
                </span>
              ) : (
                eligibleUsers.map((user) => {
                  const conflictingMain =
                    user.mainPickupAddress && user.mainPickupAddress.id !== (editing?.id ?? null)
                      ? user.mainPickupAddress
                      : null;

                  return (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        disabled={saving}
                        checked={pendingMainUserIds.has(user.id)}
                        onChange={() => toggleMainUser(user.id)}
                      />
                      {userLabel(user)}
                      {conflictingMain ? (
                        <span className="text-xs text-amber-600">
                          (currently main for {conflictingMain.name})
                        </span>
                      ) : null}
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {mainConflicts && mainConflicts.length > 0 ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p className="font-semibold">
              {mainConflicts.length === 1
                ? "The selected user already has a different main pickup address:"
                : "The following users already have a different main pickup address:"}
            </p>
            <ul className="mt-1.5 list-disc pl-5">
              {mainConflicts.map((conflict) => (
                <li key={conflict.userId}>
                  {conflict.label}: currently main for &quot;{conflict.existingAddressName}&quot;
                </li>
              ))}
            </ul>
            <p className="mt-1.5">
              Continuing will replace their existing main pickup address with this one.
            </p>
          </div>
        ) : null}

        <div className="mt-7 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="customButtonDefault">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-full bg-logoblue px-5.5 py-2.5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(39,48,151,.25)] hover:opacity-90 disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : mainConflicts && mainConflicts.length > 0
                ? "Confirm & continue"
                : isCreateMode
                  ? "Create"
                  : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
