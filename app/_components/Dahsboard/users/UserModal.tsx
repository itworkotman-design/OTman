"use client";

import React, { useState } from "react";
import Image from "next/image";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    email: string;
    number: number;
    role: string;
    active: boolean;
  }) => void;

  onRemove: () => void;
  onToggleActive: () => void;

  initialValueName: string;
  initialValueEmail: string;
  initialValueNumber: number;
  initialValueRole: string;
  initialValueActive: boolean;
};

export default function UserModal({
  isOpen,
  onClose,
  onSave,
  onRemove,
  onToggleActive,
  initialValueName,
  initialValueEmail,
  initialValueNumber,
  initialValueRole,
  initialValueActive,
}: Props) {
  const [form, setForm] = useState(() => ({
  name: initialValueName,
  email: initialValueEmail,
  number: initialValueNumber,
  role: initialValueRole,
  active: initialValueActive,
}));

  
  //updating the text fields
const updateField =
  (key: keyof typeof form) =>(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
    {setForm((prev) => ({ ...prev, [key]: e.target.value }))};
const updateNumber =
  (key: "number") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: Number(e.target.value) }));
const updateSelect =
  (key: "role") => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));




  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-center justify-center">
      <div className="bg-white w-full max-w-[1000] rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="grid grid-cols-3 items-start">
          <div />
          <h1 className="text-center font-semibold text-3xl text-logoblue whitespace-nowrap">
            Edit User
          </h1>
          <button className="ml-auto bg-logoblue text-white w-8 h-8 rounded-full font-bold grid place-items-center cursor-pointer" onClick={onClose} type="button" >
            <span className="-translate-y-px">x</span>
          </button>
        </div>

        <div className="mx-auto w-full max-w-[800]">
          <div className="lg:flex lg:gap-10 gap-2 mt-6">
            <div className="flex-1">
              <h2 className="pl-2 text-logoblue font-semibold pb-2">General</h2>
              <label className="block pb-2 pl-2">Name</label>
                <input className="customInput w-full mb-2" value={form.name} onChange={updateField("name")} type="text" />
              <label className="block pb-2 pl-2">Email</label>
                <input className="customInput w-full mb-2" value={form.email} onChange={updateField("email")} type="text" />
              <label className="block pb-2 pl-2">Number</label>
                <input className="customInput w-full mb-2" value={form.number} onChange={updateNumber("number")} type="number" />
            </div>
            <div className="flex-1">
              <h2 className="pl-2 text-logoblue font-semibold pb-2">Avatar</h2>
              <div className="border border-lineSecondary p-6">
                <div className="w-[200] h-[200] bg-red-200 rounded-full mx-auto overflow-hidden">
                  <Image src="/" alt="img"  width="200" height="200"></Image>
                </div>
                <div className="justify-self-center mt-8">
                  <button className="customButtonDefault">Upload picture</button>
                </div>
                
              </div>
              
            </div>
          </div>

          <div className="lg:flex lg:gap-10 gap-2 mt-8">
          <div className="flex-1">
            <h2 className="pl-2 text-logoblue font-semibold pb-2">Permissions</h2>
            <label className="block pb-2 pl-2">Role</label>
              <select className="customInput w-full mb-2" value={form.role} onChange={updateSelect("role")} name="role" id="">
                <option value="select" disabled>select</option>
                <option value="administration">Administration</option>
                <option value="legal">Legal</option>
                <option value="sales">Sales</option>
                <option value="IT">IT</option>
                <option value="Owner">Owner</option>
              </select>
            <h2 className="pl-2 text-logoblue font-semibold pb-2">Security</h2>
            <label className="block pb-2 pl-2">Password</label>
              <input className="customInput w-full mb-4" type="text" value={"********"} readOnly/>
              <div className="flex gap-4">
                <button className="customButtonDefault">Send reset link</button>
                <button className="customButtonDefault">Edit password</button>
              </div>  
          </div>
          <div className="flex-1">
            
              <div className="mt-4 ">
                <h2 className="text-logoblue font-semibold pb-2">Manage</h2>
                <div className="flex gap-4">
                  <button
                  type="button"
                  onClick={() => {
                    if (!confirm(form.active ? "Disable this user?" : "Enable this user?")) return;
                    setForm((p) => ({ ...p, active: !p.active }));
                    onToggleActive();
                    
                  }}
                  className={[
                    "w-40 mb-3 customButtonEnabled",
                    form.active ? "bg-red-800!" : "bg-green-700!",
                  ].join(" ")}
                  >
                    {form.active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => {
                    if (!confirm("Remove this user?")) return;
                    onRemove();
                    onClose();
                  }} className="w-40 mb-3 customButtonEnabled bg-red-800!">
                    Remove
                  </button>
                </div>
                
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
