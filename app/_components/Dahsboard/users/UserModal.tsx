"use client";

import React, { useState } from "react";
import {
  UserModalProps,
  buildInitialForm,
  getPermissions,
  getSaveButtonLabel,
  makeFieldUpdater,
  makeNumberUpdater,
  makeSelectUpdater,
} from "@/lib/users/userModal";

export default function UserModal({
  isOpen,
  onClose,
  onSave,
  onRemove,
  onToggleActive,
  actorRole,
  targetRole,
  ...props
}: UserModalProps) {
  const isCreateMode = !props.initialValueEmail;

  const [form, setForm] = useState(() =>
    buildInitialForm({ isOpen, onClose, onSave, onRemove, onToggleActive, actorRole, targetRole, ...props })
  );

  const { isActorOwner, canEditTarget, canDisableOrRemove } = getPermissions(
    actorRole,
    targetRole,
    isCreateMode
  );

  const updateField = (key: "name" | "email" | "description") =>
    makeFieldUpdater(key, setForm);
  const updateNumber = () => makeNumberUpdater("number", setForm);
  const updateSelect = (key: "role" | "priceList") =>
    makeSelectUpdater(key, setForm);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="customContainer max-h-[90vh] w-full max-w-[1000px] overflow-y-auto bg-white">
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

        <div className="mx-auto w-full max-w-[800px]">
          <div className="mt-6 gap-8 lg:flex lg:gap-10">
            {/* ── General ── */}
            <div className="flex-1">
              <h2 className="pl-2 pb-2 font-semibold text-logoblue">General</h2>

              <label className="block pl-2 pb-2">Name</label>
              <input className="customInput mb-2 w-full" value={form.name} onChange={updateField("name")} type="text" disabled={!canEditTarget} />

              <label className="block pl-2 pb-2">Email</label>
              <input className="customInput mb-2 w-full" value={form.email} onChange={updateField("email")} type="text" disabled={!canEditTarget} />

              <label className="block pl-2 pb-2">Number</label>
              <input className="customInput mb-2 w-full" value={form.number || ""} onChange={updateNumber()} type="number" disabled={!canEditTarget} />

              <label className="block pl-2 pb-2">Description</label>
              <textarea className="customInput mb-2 min-h-[120px] w-full resize-y" value={form.description} onChange={updateField("description")} placeholder="Description" disabled={!canEditTarget} />
            </div>

            {/* ── Permissions & Security ── */}
            <div className="flex-1">
              <h2 className="pl-2 pb-2 font-semibold text-logoblue">Permissions</h2>

              <label className="block pl-2 pb-2">Role</label>
              <select className="customInput mb-4 w-full" value={form.role} onChange={updateSelect("role")} name="role" disabled={!canEditTarget}>
                {isActorOwner && <option value="OWNER">Owner</option>}
                <option value="ADMIN">Admin</option>
                <option value="USER">User</option>
              </select>

              <label className="block pl-2 pb-2">Price list</label>
              <select className="customInput mb-6 w-full" value={form.priceList} onChange={updateSelect("priceList")} name="priceList" disabled={!canEditTarget}>
                <option value="DEFAULT">DEFAULT</option>
                <option value="POWER">POWER</option>
              </select>

              <h2 className="pl-2 pb-2 font-semibold text-logoblue">Security</h2>

              <label className="block pl-2 pb-2">Password</label>
              <input className="customInput mb-4 w-full" type="text" value={isCreateMode ? "Will be set by invited user" : "********"} readOnly disabled={!canEditTarget} />

              <div className="flex gap-4">
                <button type="button" className="customButtonDefault" disabled={!canEditTarget}>Send reset link</button>
                <button type="button" className="customButtonDefault" disabled={!canEditTarget}>Edit password</button>
              </div>

              {/* ── Manage ── */}
              {canDisableOrRemove && (
                <div className="mt-8">
                  <h2 className="pb-2 font-semibold text-logoblue">Manage</h2>

                  <div className="mb-4 rounded-lg border border-lineSecondary p-4">
                    <div className="mb-2 text-sm text-textColorSecond">Current status</div>
                    <div className={`font-semibold ${form.active ? "text-green-700" : "text-red-700"}`}>
                      {form.active ? "Active" : "Disabled"}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => { if (!confirm(form.active ? "Disable this user?" : "Enable this user?")) return; onToggleActive(); }}
                      className={["mb-3 w-40 customButtonEnabled", form.active ? "bg-red-800!" : "bg-green-700!"].join(" ")}
                    >
                      {form.active ? "Disable" : "Enable"}
                    </button>

                    <button
                      type="button"
                      onClick={() => { if (!confirm("Remove this user?")) return; onRemove(); onClose(); }}
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
              onClick={() => { onSave(form); onClose(); }}
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