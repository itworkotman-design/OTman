// app/_components/Dahsboard/users/UserModal.tsx
"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import {
  getUserLogoDisplayPath,
} from "@/lib/users/profileAppearance";

import {
  UserModalProps,
  buildInitialForm,
  getPermissions,
  getSaveButtonLabel,
  makeFieldUpdater,
  makeSelectUpdater,
  togglePriceListId,
  updateAppAccessModule,
} from "@/lib/users/userModal";
import {
  BINARY_ADMIN_ONLY_MODULES,
  defaultAppAccessRows,
  MODULE_COLORS,
  MODULE_LABELS,
} from "@/lib/users/appAccessDefaults";
import type { AppModule, Role } from "@/lib/users/types";

const AVATAR_COLOR_SWATCHES = ["#273097", "#7a5cc7", "#2e9e6b", "#c67139", "#c0507a", "#3a8fb7"];

type EditSection = "GENERAL" | "ACCESS" | "SECURITY";

const SECTIONS: { id: EditSection; label: string }[] = [
  { id: "GENERAL", label: "General" },
  { id: "ACCESS", label: "App access & roles" },
  { id: "SECURITY", label: "Security" },
];

// Booking is the one module where the legacy Permission system already
// draws a real distinction between the two non-admin levels — "Viewer" is
// a Subcontractor (read-only), "Admin" is an Order creator (can create
// orders) — see lib/users/access.ts's isSubcontractorAccess/isOrderCreatorAccess.
// That only applies to plain USER-role members though: an OWNER/ADMIN gets
// full Booking access regardless of their own level (lib/orders/archiveAccess.ts
// short-circuits on company Role first), so the generic Viewer/Admin labels
// stay accurate for them instead of implying a restriction that isn't real.
function getLevelOptionLabels(module: AppModule, role: string): { viewer: string; admin: string } {
  if (module === "BOOKING" && role === "USER") {
    return { viewer: "Subcontractor", admin: "Order creator" };
  }
  return { viewer: "Viewer", admin: "Admin" };
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10.5 shrink-0 rounded-full transition-colors ${
        checked ? "bg-logoblue" : "bg-black/15"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`absolute left-0.75 top-0.75 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4.5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function UserModal({
  isOpen,
  formResetKey,
  onClose,
  onSave,
  onToggleActive,
  isOwner,
  isUmAdmin,
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
  initialValueAppAccess,
  priceLists,
  initialPriceListIds,
}: UserModalProps) {
  const isCreateMode = !initialValueEmail;

  const [section, setSection] = useState<EditSection>("GENERAL");

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
      initialValueAppAccess,
      initialPriceListIds,
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
        initialValueAppAccess,
        initialPriceListIds,
      }),
    );
    setSection("GENERAL");
  }, [isOpen, formResetKey]);
  const [sendingReset, setSendingReset] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    getUserLogoDisplayPath(initialValueLogoPath),
  );

  const { isNonOwnerUmAdmin, canEditTarget, canToggleActive } = getPermissions(isOwner, isUmAdmin, targetRole, isCreateMode);

  // A Viewer-tier actor (not Owner, no USER_MANAGEMENT/Admin grant) only
  // ever sees General — App access & Security expose role/permission
  // controls they have no authority to even look at.
  const visibleSections = isUmAdmin ? SECTIONS : SECTIONS.filter((s) => s.id === "GENERAL");

  const updateField = (key: "username" | "email" | "warehouseEmail" | "phoneNumber" | "description" | "password" | "confirmPassword") =>
    makeFieldUpdater(key, setForm);
  const updateAddress = (value: string) => setForm((prev) => ({ ...prev, address: value }));
  const updateUsernameDisplayColor = (value: string) => setForm((prev) => ({ ...prev, usernameDisplayColor: value }));

  const handleTogglePriceList = (id: string) => togglePriceListId(id, setForm);
  const updateProvisionMode = makeSelectUpdater("provisionMode", setForm);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setLogoPreviewUrl(getUserLogoDisplayPath(initialValueLogoPath));
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
      // Access is independent of company Role once a person exists — changing
      // Role never silently overwrites their per-app grants. For a brand new
      // user there's nothing to preserve yet, so default the access matrix
      // from the newly selected Role instead.
      appAccess: isCreateMode ? defaultAppAccessRows(nextRole as Role, []) : prev.appAccess,
    }));
  };

  const shouldShowProvisionSelector = isCreateMode;
  const shouldShowPasswordInputs = isCreateMode && form.provisionMode === "DIRECT_PASSWORD";
  const colorPreview = form.usernameDisplayColor || "#273097";

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
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault();
        }
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-[1040] overflow-y-auto rounded-3xl bg-white p-9 shadow-[0_20px_60px_rgba(0,0,0,.25)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-8 top-7 grid h-8.5 w-8.5 cursor-pointer place-items-center rounded-full bg-logoblue text-white"
        >
          ✕
        </button>

        <h1 className="mb-6 text-center text-[26px] font-extrabold text-logoblue">
          {isCreateMode ? "Add user" : "Edit user"}
        </h1>

        <div className="mb-7 flex gap-1 border-b border-black/8">
          {visibleSections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`-mb-px mr-6 border-b-2 px-1 py-2.5 text-sm font-bold transition-colors ${
                section === s.id
                  ? "border-logoblue text-logoblue"
                  : "border-transparent text-textColorThird hover:text-textColorSecond"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {section === "GENERAL" && (
          <div className="mx-auto w-full max-w-[760]">
            <div className="mb-6 flex flex-wrap items-start gap-6">
              <div className="flex flex-col items-center gap-2">
                {logoPreviewUrl ? (
                  <div className="grid h-21 w-21 shrink-0 place-items-center overflow-hidden rounded-full bg-black/5 p-2">
                    <img src={logoPreviewUrl} alt="User logo preview" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div
                    className="grid h-21 w-21 place-items-center rounded-full text-2xl font-bold text-white"
                    style={{ backgroundColor: colorPreview }}
                  >
                    {(form.username || form.email || "?").trim().charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="flex gap-2">
                  <label
                    className={`rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-textColorSecond ${
                      canEditTarget ? "cursor-pointer hover:bg-black/3" : "cursor-not-allowed opacity-50"
                    }`}
                  >
                    Upload
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoChange}
                      disabled={!canEditTarget}
                      className="hidden"
                    />
                  </label>
                  {logoPreviewUrl && (
                    <button
                      type="button"
                      className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-textColorSecond hover:bg-black/3"
                      onClick={handleRemoveLogo}
                      disabled={!canEditTarget}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="min-w-52 flex-1">
                <div className="mb-2 text-sm font-semibold text-textcolor">Username display color</div>
                <div className="flex flex-wrap items-center gap-2">
                  {AVATAR_COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => updateUsernameDisplayColor(swatch)}
                      disabled={!canEditTarget}
                      aria-label={swatch}
                      className={`h-7 w-7 rounded-full border-2 ${
                        colorPreview.toLowerCase() === swatch ? "border-logoblue" : "border-transparent"
                      }`}
                      style={{ backgroundColor: swatch }}
                    />
                  ))}
                  <input
                    type="color"
                    value={colorPreview}
                    onChange={(e) => updateUsernameDisplayColor(e.target.value)}
                    disabled={!canEditTarget}
                    title="Custom color"
                    className="h-7 w-7 cursor-pointer rounded-full border border-lineSecondary p-0"
                  />
                  <button
                    type="button"
                    className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-textColorThird hover:bg-black/3"
                    onClick={() => updateUsernameDisplayColor("")}
                    disabled={!canEditTarget}
                  >
                    Clear color
                  </button>
                </div>
                <div className="mt-3 font-semibold" style={{ color: colorPreview }}>
                  {form.username || form.email || "Preview"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <label className="block pb-1.5 text-sm font-semibold text-textcolor">Username</label>
                <input
                  className="customInput w-full"
                  value={form.username || ""}
                  onChange={updateField("username")}
                  type="text"
                  autoComplete="off"
                  disabled={!canEditTarget}
                />
              </div>

              <div>
                <label className="block pb-1.5 text-sm font-semibold text-textcolor">Number</label>
                <input
                  className="customInput w-full"
                  value={form.phoneNumber || ""}
                  onChange={updateField("phoneNumber")}
                  type="tel"
                  autoComplete="off"
                  disabled={!canEditTarget}
                />
              </div>

              <div>
                <label className="block pb-1.5 text-sm font-semibold text-textcolor">Email</label>
                <input
                  className="customInput w-full"
                  value={form.email}
                  onChange={updateField("email")}
                  type="email"
                  autoComplete={isCreateMode ? "off" : "email"}
                  disabled={!canEditTarget}
                />
              </div>

              <div>
                <label className="block pb-1.5 text-sm font-semibold text-textcolor">Warehouse email</label>
                <input
                  className="customInput w-full"
                  value={form.warehouseEmail}
                  onChange={updateField("warehouseEmail")}
                  type="email"
                  autoComplete="off"
                  disabled={!canEditTarget}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block pb-1.5 text-sm font-semibold text-textcolor">Address</label>
                <AddressAutocompleteInput value={form.address} onChange={updateAddress} placeholder="Enter an address" disabled={!canEditTarget} />
              </div>

              <div className="sm:col-span-2">
                <label className="block pb-1.5 text-sm font-semibold text-textcolor">Description</label>
                <textarea
                  className="customInput min-h-[100] w-full resize-y"
                  value={form.description}
                  onChange={updateField("description")}
                  placeholder="Description"
                  disabled={!canEditTarget}
                />
              </div>
            </div>
          </div>
        )}

        {section === "ACCESS" && (
          <div>
            <label className="block pb-2 text-sm font-semibold text-textcolor">Company role</label>
            <select
              className="customInput mb-6 w-full max-w-70"
              value={form.role}
              onChange={updateRole}
              name="role"
              disabled={!canEditTarget}
            >
              {isOwner && <option value="OWNER">Owner</option>}
              {isOwner && <option value="ADMIN">Admin</option>}
              <option value="USER">User</option>
            </select>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {form.appAccess.map((row) => {
                const levelLabels = getLevelOptionLabels(row.module, form.role);
                const color = MODULE_COLORS[row.module];
                const isBookingModule = row.module === "BOOKING";
                // BINARY_ADMIN_ONLY_MODULES have no Viewer concept at all —
                // enabling them is inherently an Admin-level grant, which a
                // non-owner can never hand out, so both the toggle and level
                // are fully locked for those (this includes USER_MANAGEMENT,
                // which only an Owner may grant/revoke in either direction).
                // For every other non-Booking module (e.g. Archive) they can
                // toggle it on/off and pick Viewer freely, but the Admin
                // option itself is locked out (Booking's Viewer/Admin is
                // Subcontractor vs Order creator, an order permission, not
                // an admin grant, so it's exempt from both restrictions).
                const isBinaryAdminOnlyModule = BINARY_ADMIN_ONLY_MODULES.includes(row.module);
                const moduleToggleLocked = isNonOwnerUmAdmin && isBinaryAdminOnlyModule;
                const moduleLevelLocked = isNonOwnerUmAdmin && isBinaryAdminOnlyModule;
                const adminOptionLocked = isNonOwnerUmAdmin && !isBookingModule && !isBinaryAdminOnlyModule;

                return (
                  <div key={row.module} className="self-start overflow-hidden rounded-2xl border border-lineSecondary">
                    <div className={`flex items-center gap-3.5 p-4 ${row.enabled ? "" : "opacity-50"}`}>
                      <span
                        className="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-[11px] text-sm font-extrabold text-white"
                        style={{ backgroundColor: row.enabled ? color : "#a3a3a3" }}
                      >
                        {MODULE_LABELS[row.module].charAt(0)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-textcolor">{MODULE_LABELS[row.module]}</div>
                        <div className={`text-[11.5px] font-semibold ${row.enabled ? "text-textColorSecond" : "text-textColorThird"}`}>
                          {row.enabled ? "Enabled" : "Not enabled"}
                        </div>
                      </div>

                      <ToggleSwitch
                        checked={row.enabled}
                        onChange={(next) => updateAppAccessModule(row.module, { enabled: next }, setForm)}
                        disabled={!canEditTarget || moduleToggleLocked}
                      />
                    </div>

                    {row.enabled && (
                      <div className="px-4 pb-4">
                        <select
                          className="w-full rounded-lg border border-lineSecondary bg-white px-2.5 py-1.5 text-[12.5px] font-bold text-textcolor"
                          value={row.level}
                          onChange={(e) =>
                            updateAppAccessModule(row.module, { level: e.target.value as "VIEWER" | "ADMIN" }, setForm)
                          }
                          disabled={!canEditTarget || moduleLevelLocked}
                        >
                          <option value="VIEWER">{levelLabels.viewer}</option>
                          <option value="ADMIN" disabled={adminOptionLocked}>
                            {levelLabels.admin}
                          </option>
                        </select>

                        {row.module === "BOOKING" && form.role !== "USER" && (
                          <p className="mt-2 text-xs text-textColorThird">
                            As {form.role === "OWNER" ? "an Owner" : "an Admin"}, they always have full Booking access
                            regardless of this setting.
                          </p>
                        )}

                        {row.module === "BOOKING" && (
                          <div className="mt-3 border-t pt-3" style={{ borderColor: `${color}33` }}>
                            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-textColorSecond">
                              Price lists
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {priceLists && priceLists.length > 0 ? (
                                priceLists.map((pl) => {
                                  const checked = form.priceListIds.includes(pl.id);
                                  return (
                                    <label
                                      key={pl.id}
                                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                        canEditTarget ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                                      } ${checked ? "text-white" : "text-textColorSecond"}`}
                                      style={{
                                        backgroundColor: checked ? color : "#fff",
                                        borderColor: checked ? color : "rgba(0,0,0,.15)",
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => handleTogglePriceList(pl.id)}
                                        disabled={!canEditTarget}
                                        className="hidden"
                                      />
                                      {pl.name}
                                    </label>
                                  );
                                })
                              ) : (
                                <span className="text-xs text-textColorThird">No price lists available</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {section === "SECURITY" && (
          <div className="max-w-90">
            {shouldShowProvisionSelector && (
              <>
                <label className="block pb-2 text-sm font-semibold text-textcolor">Setup method</label>
                <select className="customInput mb-4 w-full" value={form.provisionMode} onChange={updateProvisionMode} disabled={!canEditTarget}>
                  <option value="DIRECT_PASSWORD">Set password now</option>
                  <option value="INVITE">Send invite link</option>
                </select>
              </>
            )}

            <label className="block pb-2 text-sm font-semibold text-textcolor">Password</label>
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
                value={isCreateMode ? "Will be set by invited user" : "********"}
                readOnly
                disabled={!canEditTarget}
              />
            )}

            <div className="flex gap-4">
              <button type="button" className="customButtonDefault" disabled={!canEditTarget || isCreateMode || sendingReset} onClick={handleSendReset}>
                {sendingReset ? "Sending..." : "Send reset link"}
              </button>
            </div>

            {canToggleActive && (
              <div className="mt-8">
                <h2 className="pb-2 text-sm font-bold text-logoblue">Account status</h2>

                <div className="mb-4 rounded-lg border border-lineSecondary p-4">
                  <div className="mb-2 text-sm text-textColorSecond">Current status</div>
                  <div className={`font-semibold ${form.active ? "text-green-700" : "text-red-700"}`}>{form.active ? "Active" : "Disabled"}</div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(form.active ? "Disable this user?" : "Enable this user?")) {
                      return;
                    }
                    onToggleActive();
                  }}
                  className={["w-40 customButtonEnabled", form.active ? "bg-red-800!" : "bg-green-700!"].join(" ")}
                >
                  {form.active ? "Disable" : "Enable"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-9 flex justify-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/12 bg-white px-7 py-2.5 text-sm font-bold text-textColorSecond hover:bg-black/3"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              void handleSave();
            }}
            className="rounded-full bg-logoblue px-10 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!canEditTarget}
          >
            {getSaveButtonLabel(isCreateMode, canEditTarget, form.provisionMode)}
          </button>
        </div>
      </div>
    </div>
  );
}
