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

const updateRole =
  (key: "role") => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));
  const updatePriceList =
  (key: "priceList") => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  if (!isOpen) return null;

  return (
    <div className="absolute top-120 lg:top-0 lg:fixed inset-0 z-5 bg-black/40 flex items-center justify-center">
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

        <div className="mt-6 lg:px-6">
          <h2 className="pl-2 text-logoblue font-semibold pb-2">Information</h2>
          <div className="flex lg:gap-10 gap-2">
            <div className="flex-1">
              <label className="block pb-2 pl-2">Name</label>
                <input className="customInput w-full mb-2" value={form.name} onChange={updateField("name")} type="text" />
              <label className="block pb-2 pl-2">Company</label>
                <input className="customInput w-full mb-2" value={form.company} onChange={updateField("company")} type="text" />
            </div>
            <div className="flex-1">
              <label className="block pb-2 pl-2">Email</label>
                <input className="customInput w-full mb-2" value={form.email} onChange={updateField("email")} type="text" />
              <label className="block pb-2 pl-2">Number</label>
                <input className="customInput w-full mb-2 " value={form.number} onChange={updateField("number")} type="text" />
            </div>
            
          </div>
          <div>
            <label className="block pb-2 pl-2">Info</label>
              <textarea
                className="customInput w-full mb-2 h-20 resize-none"
                value={form.info}
                onChange={updateField("info")}
              />
          </div>
          

          <div className="mt-6">
            <div className="flex lg:gap-10 gap-2">
              <div className="flex-1">
                <h2 className="pl-2 text-logoblue font-semibold pb-2">
                  Permissions
                </h2>
                <label className="block pb-2 pl-2">Role</label>
                <select className="customInput w-full mb-2" value={form.role} onChange={updateRole("role")} name="role" id="">
                  <option value="select" disabled>select</option>
                  <option value="admin">Admin</option>
                  <option value="subcontractor">Subcontractor</option>
                  <option value="power">Power</option>
                </select>
                <label className="block pb-2 pl-2">Price list</label>
                <select className="customInput w-full mb-2" value={form.priceList} onChange={updatePriceList("priceList")} name="priceList" id="">
                  <option value="select" disabled>select</option>
                  <option value="default">default</option>
                  <option value="power">Power</option>
                </select>
              </div>
              <div className="flex-1">
                <h2 className="pl-2 text-logoblue font-semibold pb-2">
                  Security
                </h2>
                <label className="block pb-2 pl-2">Password</label>
                  <input className="customInput w-full mb-2" value="********" readOnly />
              </div>
              
            </div>

            <div className="mt-6">
              <h2 className="pl-2 text-logoblue font-semibold pb-2">Manage</h2>
              <div className="flex lg:block lg:gap-10 gap-2 justify-between">
                <button
                type="button"
                onClick={() => {
                  if (!confirm(form.active ? "Disable this user?" : "Enable this user?")) return;
                  onToggleActive(); // updates parent list
                  setForm((p) => ({ ...p, active: !p.active })); // update UI immediately
                }}
                className={[
                  "block w-40 mb-3 customButtonEnabled",
                  form.active ? "bg-red-800!" : "bg-green-700!",
                ].join(" ")}
              >
                {form.active ? "Disable" : "Enable"}
              </button>
              <button onClick={() => {
                console.log("REMOVE CLICKED");
                if (!confirm("Remove this user?")) return;
                onRemove();
                onClose();
              }} className="block w-40 mb-3 customButtonEnabled bg-red-800!">
                Remove
              </button>
              </div>
              
            </div>
          </div>

          <div className="flex justify-center mt-10">
            <button onClick={() => { onSave(form); onClose(); }} className="w-96 customButtonEnabled" type="button">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
