"use client";

import { useState } from "react";
import EditUserModal from "@/app/_components/(booking)/users/EditUserModal";


export default function UserPage() {
const [isOpen, setIsOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);

  const [name, setName] = useState("Janis");
  const [company, setCompany] = useState("OtmanTransportAS");
  const [email, setEmail] = useState("lalala@otman.no");
  const [number, setNumber] = useState("12345678");
  const [info, setInfo] = useState("Some info...");
  const [role, setRole] = useState("Admin");

  const openModal = () => {
    setModalKey((k) => k + 1);
    setIsOpen(true);
  };

  
  return (
    <div className="p-6">
      <button className="bg-logoblue text-white px-4 py-2 rounded" onClick={openModal}>
        Edit user
      </button>

      <EditUserModal
        key={modalKey}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={({ name, company, email, number, info, role }) => {
          setName(name);
          setCompany(company);
          setEmail(email);
          setNumber(number);
          setInfo(info);
          setRole(role);
        }}
        initialValueName={name}
        initialValueCompany={company}
        initialValueEmail={email}
        initialValueNumber={number}
        initialValueInfo={info}
        initialValueRole={role}
      />
    </div>
  );
}
