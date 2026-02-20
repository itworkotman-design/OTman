"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    company: string;
    email: string;
    number: string;
    info: string;
    role: string;
    priceList: string;
    active: boolean;
  }) => void;

  onRemove: () => void;
  onToggleActive: () => void;

  initialValueName: string;
  initialValueCompany: string;
  initialValueEmail: string;
  initialValueNumber: string;
  initialValueInfo: string;
  initialValueRole: string;
  initialValuePriceList: string;
  initialValueActive: boolean;
};

export default function EditUserModal({
  isOpen,
  onClose,
  onSave,
  onRemove,
  onToggleActive,
  initialValueName,
  initialValueCompany,
  initialValueEmail,
  initialValueNumber,
  initialValueInfo,
  initialValueRole,
  initialValuePriceList,
  initialValueActive,
}: Props) {
  const [form, setForm] = useState({
    name: initialValueName,
    company: initialValueCompany,
    email: initialValueEmail,
    number: initialValueNumber,
    info: initialValueInfo,
    role: initialValueRole,
    priceList: initialValuePriceList,
    active: initialValueActive,
  });

  const updateField =(key: keyof typeof form) =>(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {setForm((prev) => ({ ...prev, [key]: e.target.value }))};

  // auto-grow
  const infoRef = useRef<HTMLTextAreaElement>(null);
  const autoGrow = () => {
    const el = infoRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    if (!isOpen) return;
    autoGrow(); 
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-5 ml-75 bg-black/40 flex items-center justify-center">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow p-6">
        <div className="grid grid-cols-3 items-start">
          <div />
          <h1 className="text-center font-semibold text-3xl text-logoblue">
            Edit User
          </h1>
          <button className="ml-auto bg-logoblue text-white w-8 h-8 rounded-full font-bold grid place-items-center cursor-pointer" onClick={onClose} type="button" >
            <span className="-translate-y-px">x</span>
          </button>
        </div>

        <div className="mt-6 px-6">
          <h2 className="pl-2 text-logoblue font-semibold pb-2">Information</h2>

          <table className="w-full table-fixed border-collapse">
            <tbody>
              <tr>
                <td className="px-4 py-2 border border-black/20">Name</td>
                <td className="border border-black/20">
                  <input value={form.name} onChange={updateField("name")} className="w-full px-3 py-2 border-none outline-none focus:ring-0" />
                </td>

                <td className="px-4 py-2 border border-black/20">Company</td>
                <td className="border border-black/20">
                  <input value={form.company} onChange={updateField("company")} className="w-full px-3 py-2 border-none outline-none focus:ring-0" />
                </td>
              </tr>

              <tr>
                <td className="px-4 py-2 border border-black/20">Email</td>
                <td className="border border-black/20">
                  <input value={form.email} onChange={updateField("email")} className="w-full px-3 py-2 border-none outline-none focus:ring-0" />
                </td>

                <td className="px-4 py-2 border border-black/20">Number</td>
                <td className="border border-black/20">
                  <input value={form.number} onChange={updateField("number")} className="w-full px-3 py-2 border-none outline-none focus:ring-0" />
                </td>
              </tr>

              <tr>
                <td className="px-4 py-2 border border-black/20 align-top">
                  Info
                </td>
                <td className="border border-black/20 align-top" colSpan={3}>
                  <textarea ref={infoRef} value={form.info} onChange={(e) => { updateField("info")(e); requestAnimationFrame(autoGrow); }} rows={1} className="w-full px-3 py-2 resize-none overflow-hidden border-none outline-none focus:ring-0"/>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-8 mt-6">
            <div>
              <h2 className="pl-2 text-logoblue font-semibold pb-2">
                Permissions
              </h2>

              <table className="w-full table-fixed border-collapse">
                <tbody>
                  <tr>
                    <td className="px-4 py-2 border border-black/20">Role</td>
                    <td className="border border-black/20">
                      <input value={form.role} onChange={updateField("role")} className="w-full px-3 py-2 border-none outline-none focus:ring-0"/>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border border-black/20">Price List</td>
                    <td className="border border-black/20">
                      <input value={form.priceList} onChange={updateField("priceList")} className="w-full px-3 py-2 border-none outline-none focus:ring-0"/>
                    </td>
                  </tr>
                </tbody>
              </table>

              <h2 className="pl-2 text-logoblue font-semibold pb-2 pt-6">
                Security
              </h2>

              <table className="w-full table-fixed border-collapse">
                <tbody>
                  <tr>
                    <td className="px-4 py-2 border border-black/20">
                      Password
                    </td>
                    <td className="border border-black/20">
                      <input
                        value="*******"
                        readOnly
                        className="w-full px-3 py-2 border-none outline-none focus:ring-0"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="ml-auto">
              <h2 className="pl-2 text-logoblue font-semibold pb-2">Manage</h2>
              <button
                type="button"
                onClick={() => {
                  if (!confirm(form.active ? "Disable this user?" : "Enable this user?")) return;
                  onToggleActive(); // updates parent list
                  setForm((p) => ({ ...p, active: !p.active })); // update UI immediately
                }}
                className={[
                  "block w-40 py-1 rounded-2xl text-white font-semibold mb-3 cursor-pointer",
                  form.active ? "bg-red-800" : "bg-green-700",
                ].join(" ")}
              >
                {form.active ? "Disable" : "Enable"}
              </button>
              <button onClick={() => {
                console.log("REMOVE CLICKED");
                if (!confirm("Remove this user?")) return;
                onRemove();
                onClose();
              }} className="block bg-red-800 w-40 py-1 rounded-2xl text-white font-semibold cursor-pointer">
                Remove
              </button>
            </div>
          </div>

          <div className="flex justify-center mt-10">
            <button onClick={() => { onSave(form); onClose(); }} className="bg-logoblue text-white w-96 py-3 rounded-full font-semibold cursor-pointer" type="button">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
