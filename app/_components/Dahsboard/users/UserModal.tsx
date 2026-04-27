// app/_components/Dahsboard/users/UserModal.tsx
"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";

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
  formResetKey,
  onClose,
  onSave,
  onToggleActive,
  actorRole,
  targetRole,
  initialValueUsername,
  initialValueEmail,
  initialValueWarehouseEmail,
  initialValuePhoneNumber,
  initialValueAddress,
  initialValueDescription,
  initialValueLogoPath,
  initialValueUsernameDisplayColor,
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
      initialValueWarehouseEmail,
      initialValuePhoneNumber,
      initialValueAddress,
      initialValueDescription,
      initialValueLogoPath,
      initialValueUsernameDisplayColor,
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
        initialValueWarehouseEmail,
        initialValuePhoneNumber,
        initialValueAddress,
        initialValueDescription,
        initialValueLogoPath,
        initialValueUsernameDisplayColor,
        initialValueRole,
        initialValueActive,
        initialValuePermissions,
        initialPriceListId,
      }),
    );
  }, [isOpen, formResetKey]);
  const [sendingReset, setSendingReset] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    initialValueLogoPath ?? null,
  );

  const { isActorOwner, canEditTarget, canToggleActive } = getPermissions(
    actorRole,
    targetRole,
    isCreateMode,
  );

  const updateField = (
    key:
      | "username"
      | "email"
      | "warehouseEmail"
      | "phoneNumber"
      | "description"
      | "password"
      | "confirmPassword",
  ) => makeFieldUpdater(key, setForm);
  const updateAddress = (value: string) =>
    setForm((prev) => ({ ...prev, address: value }));
  const updateUsernameDisplayColor = (value: string) =>
    setForm((prev) => ({ ...prev, usernameDisplayColor: value }));

  const updatePriceList = makeSelectUpdater("priceListId", setForm);
  const updateProvisionMode = makeSelectUpdater("provisionMode", setForm);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setLogoPreviewUrl(initialValueLogoPath ?? null);
  }, [isOpen, formResetKey, initialValueLogoPath]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const updateRole = (e: ChangeEvent<HTMLSelectElement>) => {
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
  const shouldShowProvisionSelector = isCreateMode;
  const shouldShowPasswordInputs =
    isCreateMode && form.provisionMode === "DIRECT_PASSWORD";
  const colorPreview = form.usernameDisplayColor || "#273097";

  const updateAccessType = (e: ChangeEvent<HTMLSelectElement>) => {
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

  async function handleSave() {
    if (shouldShowPasswordInputs && form.password.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }

    if (shouldShowPasswordInputs && form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    await onSave(form);
  }

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const nextFile = e.target.files?.[0] ?? null;

    if (!nextFile) {
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(nextFile);

    setLogoPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }

      return nextPreviewUrl;
    });

    setForm((prev) => ({
      ...prev,
      logoFile: nextFile,
    }));
  }

  function handleRemoveLogo() {
    setLogoPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }

      return null;
    });

    setForm((prev) => ({
      ...prev,
      logoPath: null,
      logoFile: null,
    }));
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
                autoComplete="off"
                disabled={!canEditTarget}
              />

              <label className="block pl-2 pb-2">Email</label>
              <input
                className="customInput mb-2 w-full"
                value={form.email}
                onChange={updateField("email")}
                type="email"
                autoComplete={isCreateMode ? "off" : "email"}
                disabled={!canEditTarget}
              />

              <label className="block pl-2 pb-2">Warehouse email</label>
              <input
                className="customInput mb-2 w-full"
                value={form.warehouseEmail}
                onChange={updateField("warehouseEmail")}
                type="email"
                autoComplete="off"
                disabled={!canEditTarget}
              />

              <label className="block pl-2 pb-2">Number</label>
              <input
                className="customInput mb-2 w-full"
                value={form.phoneNumber || ""}
                onChange={updateField("phoneNumber")}
                type="tel"
                autoComplete="off"
                disabled={!canEditTarget}
              />

              <label className="block pl-2 pb-2">Address</label>
              <div className="mb-2">
                <AddressAutocompleteInput
                  value={form.address}
                  onChange={updateAddress}
                  placeholder="Enter an address"
                  disabled={!canEditTarget}
                />
              </div>

              <label className="block pl-2 pb-2">Description</label>
              <textarea
                className="customInput mb-2 min-h-[120] w-full resize-y"
                value={form.description}
                onChange={updateField("description")}
                placeholder="Description"
                disabled={!canEditTarget}
              />

              <label className="block pl-2 pb-2">Logo</label>
              <div className="mb-4 rounded-lg border border-lineSecondary p-4">
                {logoPreviewUrl ? (
                  <div className="mb-3 flex items-center gap-3">
                    {logoPreviewUrl.endsWith(".svg") ||
                    logoPreviewUrl.startsWith("blob:") ? (
                      <img
                        src={logoPreviewUrl}
                        alt="User logo preview"
                        className="h-14 w-14 object-contain"
                      />
                    ) : (
                      <Image
                        src={logoPreviewUrl}
                        alt="User logo preview"
                        width={56}
                        height={56}
                        className="h-14 w-14 object-contain"
                        unoptimized={logoPreviewUrl.startsWith("blob:")}
                      />
                    )}
                    <button
                      type="button"
                      className="customButtonDefault"
                      onClick={handleRemoveLogo}
                      disabled={!canEditTarget}
                    >
                      Remove logo
                    </button>
                  </div>
                ) : (
                  <div className="mb-3 text-sm text-textColorSecond">
                    No logo uploaded
                  </div>
                )}

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoChange}
                  disabled={!canEditTarget}
                />
              </div>

              <label className="block pl-2 pb-2">Username display color</label>
              <div className="mb-4 flex items-center gap-3">
                <input
                  type="color"
                  value={colorPreview}
                  onChange={(e) => updateUsernameDisplayColor(e.target.value)}
                  disabled={!canEditTarget}
                />
                <div className="font-semibold" style={{ color: colorPreview }}>
                  {form.username || form.email || "Preview"}
                </div>
                <button
                  type="button"
                  className="customButtonDefault"
                  onClick={() => updateUsernameDisplayColor("")}
                  disabled={!canEditTarget}
                >
                  Clear color
                </button>
              </div>
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

              {shouldShowProvisionSelector && (
                <>
                  <label className="block pl-2 pb-2">Setup method</label>
                  <select
                    className="customInput mb-4 w-full"
                    value={form.provisionMode}
                    onChange={updateProvisionMode}
                    disabled={!canEditTarget}
                  >
                    <option value="DIRECT_PASSWORD">Set password now</option>
                    <option value="INVITE">Send invite link</option>
                  </select>
                </>
              )}

              <label className="block pl-2 pb-2">Password</label>
              {shouldShowPasswordInputs ? (
                <>
                  <input
                    className="customInput mb-2 w-full"
                    type="password"
                    value={form.password}
                    onChange={updateField("password")}
                    placeholder="Enter password"
                    autoComplete="new-password"
                    disabled={!canEditTarget}
                  />
                  <input
                    className="customInput mb-4 w-full"
                    type="password"
                    value={form.confirmPassword}
                    onChange={updateField("confirmPassword")}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    disabled={!canEditTarget}
                  />
                </>
              ) : (
                <input
                  className="customInput mb-4 w-full"
                  type="text"
                  value={
                    isCreateMode ? "Will be set by invited user" : "********"
                  }
                  readOnly
                  disabled={!canEditTarget}
                />
              )}

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

              {canToggleActive && (
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
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <button
              onClick={() => {
                void handleSave();
              }}
              className="customButtonEnabled h-10 w-96"
              type="button"
              disabled={!canEditTarget}
            >
              {getSaveButtonLabel(
                isCreateMode,
                canEditTarget,
                form.provisionMode,
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
