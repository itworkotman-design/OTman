// app/_components/Dahsboard/users/UserModal.tsx
"use client";

import React, { useState, useEffect } from "react";

import {
  UserModalProps,
  buildInitialForm,
  getPermissions,
  getSaveButtonLabel,
  makeFieldUpdater,
  makeSelectUpdater,
  getAccessTypeFromPermissions,
  getPermissionsFromAccessType,
  type UserAccessType,
} from "@/lib/users/userModal";

export default function UserModal({
  isOpen,
  onClose,
  onSave,
  onRemove,
  onToggleActive,
  actorRole,
  targetRole,
  initialValueUsername,
  initialValueEmail,
  initialValuePhoneNumber,
  initialValueDescription,
  initialValueRole,
  initialValueActive,
  initialValuePermissions,
  priceLists,
  initialPriceListId,
}: UserModalProps) {
  const isCreateMode = !initialValueEmail;

  const [form, setForm] = useState(() =>
    buildInitialForm({
      initialValueUsername,
      initialValueEmail,
      initialValuePhoneNumber,
      initialValueDescription,
      initialValueRole,
      initialValueActive,
      initialValuePermissions,
      initialPriceListId,
    }),
  );
  useEffect(() => {
    if (!isOpen) return;

    setForm(
      buildInitialForm({
        initialValueUsername,
        initialValueEmail,
        initialValuePhoneNumber,
        initialValueDescription,
        initialValueRole,
        initialValueActive,
        initialValuePermissions,
        initialPriceListId,
      }),
    );
  }, [
    isOpen,
    initialValueUsername,
    initialValueEmail,
    initialValuePhoneNumber,
    initialValueDescription,
    initialValueRole,
    initialValueActive,
    initialValuePermissions,
    initialPriceListId,
  ]);
  const [sendingReset, setSendingReset] = useState(false);

  const { isActorOwner, canEditTarget, canDisableOrRemove } = getPermissions(
    actorRole,
    targetRole,
    isCreateMode,
  );

  const updateField = (
    key: "username" | "email" | "phoneNumber" | "description",
  ) => makeFieldUpdater(key, setForm);

  const updatePriceList = makeSelectUpdater("priceListId", setForm);

  const updateRole = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = e.target.value;

    setForm((prev) => ({
      ...prev,
      role: nextRole,
      permissions:
        nextRole === "ADMIN" || nextRole === "OWNER"
          ? ["BOOKING_VIEW", "BOOKING_CREATE"]
          : prev.permissions.includes("BOOKING_CREATE")
            ? ["BOOKING_VIEW", "BOOKING_CREATE"]
            : ["BOOKING_VIEW"],
    }));
  };

  const accessType = getAccessTypeFromPermissions(form.permissions);

  const updateAccessType = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as UserAccessType;

    setForm((prev) => ({
      ...prev,
      permissions: getPermissionsFromAccessType(value),
    }));
  };

  const shouldShowAccessSelector = form.role === "USER";

  async function handleSendReset() {
    if (!form.email) {
      alert("User has no email");
      return;
    }

    try {
      setSendingReset(true);

      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: form.email }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        alert(data?.reason || "Failed to send reset link");
        return;
      }

      alert("Reset link sent");
    } catch {
      alert("Something went wrong");
    } finally {
      setSendingReset(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="customContainer max-h-[90vh] w-full max-w-[1000] overflow-y-auto bg-white">
        <div className="grid grid-cols-3 items-start">
          <div />
          <h1 className="whitespace-nowrap text-center text-3xl font-semibold text-logoblue">
            {isCreateMode ? "Add User" : "Edit User"}
          </h1>
          <button
            className="ml-auto grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-logoblue font-bold text-white"
            onClick={onClose}
            type="button"
          >
            <span className="-translate-y-px">x</span>
          </button>
        </div>

        <div className="mx-auto w-full max-w-[800]">
          <div className="mt-6 gap-8 lg:flex lg:gap-10">
            <div className="flex-1">
              <h2 className="pl-2 pb-2 font-semibold text-logoblue">General</h2>

              <label className="block pl-2 pb-2">Username</label>
              <input
                className="customInput mb-2 w-full"
                value={form.username || ""}
                onChange={updateField("username")}
                type="text"
                disabled={!canEditTarget}
              />

              <label className="block pl-2 pb-2">Email</label>
              <input
                className="customInput mb-2 w-full"
                value={form.email}
                onChange={updateField("email")}
                type="text"
                disabled={!canEditTarget}
              />

              <label className="block pl-2 pb-2">Number</label>
              <input
                className="customInput mb-2 w-full"
                value={form.phoneNumber || ""}
                onChange={updateField("phoneNumber")}
                type="text"
                disabled={!canEditTarget}
              />

              <label className="block pl-2 pb-2">Description</label>
              <textarea
                className="customInput mb-2 min-h-[120] w-full resize-y"
                value={form.description}
                onChange={updateField("description")}
                placeholder="Description"
                disabled={!canEditTarget}
              />
            </div>

            <div className="flex-1">
              <h2 className="pl-2 pb-2 font-semibold text-logoblue">
                Permissions
              </h2>

              <label className="block pl-2 pb-2">Role</label>
              <select
                className="customInput mb-4 w-full"
                value={form.role}
                onChange={updateRole}
                name="role"
                disabled={!canEditTarget}
              >
                {isActorOwner && <option value="OWNER">Owner</option>}
                <option value="ADMIN">Admin</option>
                <option value="USER">User</option>
              </select>

              {shouldShowAccessSelector && (
                <>
                  <label className="block pl-2 pb-2">Access</label>
                  <select
                    className="customInput mb-4 w-full"
                    value={accessType}
                    onChange={updateAccessType}
                    disabled={!canEditTarget}
                  >
                    <option value="SUBCONTRACTOR">Subcontractor</option>
                    <option value="ORDER_CREATOR">Order creator</option>
                  </select>
                </>
              )}

              <label className="block pl-2 pb-2">Price list</label>
              <select
                className="customInput mb-6 w-full"
                value={form.priceListId || ""}
                onChange={updatePriceList}
                name="priceList"
                disabled={!canEditTarget}
              >
                <option value="">No price list</option>

                {priceLists?.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </select>

              <h2 className="pl-2 pb-2 font-semibold text-logoblue">
                Security
              </h2>

              <label className="block pl-2 pb-2">Password</label>
              <input
                className="customInput mb-4 w-full"
                type="text"
                value={
                  isCreateMode ? "Will be set by invited user" : "********"
                }
                readOnly
                disabled={!canEditTarget}
              />

              <div className="flex gap-4">
                <button
                  type="button"
                  className="customButtonDefault"
                  disabled={!canEditTarget || isCreateMode || sendingReset}
                  onClick={handleSendReset}
                >
                  {sendingReset ? "Sending..." : "Send reset link"}
                </button>
                <button
                  type="button"
                  className="customButtonDefault hidden"
                  disabled={!canEditTarget}
                >
                  Edit password
                </button>
              </div>

              {canDisableOrRemove && (
                <div className="mt-8">
                  <h2 className="pb-2 font-semibold text-logoblue">Manage</h2>

                  <div className="mb-4 rounded-lg border border-lineSecondary p-4">
                    <div className="mb-2 text-sm text-textColorSecond">
                      Current status
                    </div>
                    <div
                      className={`font-semibold ${form.active ? "text-green-700" : "text-red-700"}`}
                    >
                      {form.active ? "Active" : "Disabled"}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !confirm(
                            form.active
                              ? "Disable this user?"
                              : "Enable this user?",
                          )
                        ) {
                          return;
                        }
                        onToggleActive();
                      }}
                      className={[
                        "mb-3 w-40 customButtonEnabled",
                        form.active ? "bg-red-800!" : "bg-green-700!",
                      ].join(" ")}
                    >
                      {form.active ? "Disable" : "Enable"}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm("Remove this user?")) return;

                        const ok = await onRemove();
                        if (ok) {
                          onClose();
                        }
                      }}
                      className="mb-3 w-40 customButtonEnabled bg-red-800!"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <button
              onClick={() => {
                onSave(form);
              }}
              className="customButtonEnabled h-10 w-96"
              type="button"
              disabled={!canEditTarget}
            >
              {getSaveButtonLabel(isCreateMode, canEditTarget)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
