"use client";

import { useEffect, useMemo, useState } from "react";
import { User } from "@/app/dashboard/booking/booking_users/_types/user";

export function EditUserModal({
  user,
  onClose,
  onSave,
}: {
  user: User | null;
  onClose: () => void;
  onSave: (u: User) => void;
}) {
  const open = !!user;

  const initial = useMemo(() => user, [user]);
  const [draft, setDraft] = useState<User | null>(user);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDraft(user), [initial, user]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open || !draft) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" aria-modal="true" role="dialog">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* modal */}
      <div className="relative z-10 bg-white rounded-2xl p-6 w-195">
        <button onClick={onClose} className="" aria-label="Close modal">
            X
        </button>

        <h2 className="text-center font-semibold text-logoblue text-4xl">Edit user</h2>

        <div className="mt-6 grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <div className="text-xs font-semibold text-logoblue mb-2">Information</div>
            <div className="grid grid-cols-2 gap-3 border border-black/10 p-3 rounded-md">
              <Field label="Name">
                <input
                  className="w-full border border-black/10 px-2 py-1 rounded"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Company">
                <input
                  className="w-full border border-black/10 px-2 py-1 rounded"
                  value={draft.company}
                  onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <input
                  className="w-full border border-black/10 px-2 py-1 rounded"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </Field>
              <Field label="Number">
                <input
                  className="w-full border border-black/10 px-2 py-1 rounded"
                  value={draft.number}
                  onChange={(e) => setDraft({ ...draft, number: e.target.value })}
                />
              </Field>
              <div className="col-span-2">
                <div className="text-[11px] text-black/60 mb-1">Info</div>
                <textarea
                  className="w-full border border-black/10 px-2 py-1 rounded min-h-17.5"
                  value={draft.info}
                  onChange={(e) => setDraft({ ...draft, info: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-5 text-xs font-semibold text-logoblue mb-2">Permissions</div>
            <div className="border border-black/10 p-3 rounded-md">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Role">
                  <input
                    className="w-full border border-black/10 px-2 py-1 rounded"
                    value={draft.role}
                    onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-5 text-xs font-semibold text-logoblue mb-2">Security</div>
            <div className="border border-black/10 p-3 rounded-md">
              <Field label="Password">
                <input
                  className="w-full border border-black/10 px-2 py-1 rounded"
                  value={"********"}
                  readOnly
                />
              </Field>

              <div className="mt-3 flex gap-2">
                <button className="rounded-md bg-logoblue px-3 py-2 text-white text-sm">
                  Change password
                </button>
                <button className="rounded-md bg-logoblue px-3 py-2 text-white text-sm">
                  Send Reset Link
                </button>
              </div>
            </div>
          </div>

          <div className="col-span-1">
            <div className="text-xs font-semibold text-logoblue mb-2">Edit user</div>
            <div className="flex flex-col gap-2">
              <button className="rounded-md bg-red-700 px-3 py-2 text-white text-sm">
                {draft.disabled ? "Enable" : "Disable"}
              </button>
              <button className="rounded-md bg-red-700 px-3 py-2 text-white text-sm">
                Remove
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => onSave(draft)}
          className="mt-8 w-full rounded-full bg-logoblue py-3 text-white font-semibold"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] text-black/60 mb-1">{label}</div>
      {children}
    </label>
  );
}
