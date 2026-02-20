"use client";

import { useState } from "react";
import EditUserModal from "@/app/_components/Dahsboard/booking/users/EditUserModal";
import type { User } from "./_types/user";
import { UserTable } from "@/app/_components/Dahsboard/booking/users/UserTable";

export default function UserPage() {
  const [users, setUsers] = useState<User[]>([
    {
      id: "1",
      name: "John Doe",
      email: "john@example.com",
      company: "Acme",
      number: "12345678",
      role: "Admin",
      priceList: "default",
      info: "Main contact person",
      active: true,
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane@example.com",
      company: "Beta AS",
      number: "87654321",
      role: "User",
      priceList: "power",
      info: "Handles support requests",
      active: false,
    },
  ]);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalKey, setModalKey] = useState(0);

  const closeModal = () => setSelectedUser(null);

  const addUser = () => {
    const newUser: User = {
      id: crypto.randomUUID(), // or String(Date.now())
      name: "",
      email: "",
      company: "",
      number: "",
      role: "User",
      priceList: "default",
      info: "",
      active: true,
    };

    setUsers((prev) => [newUser, ...prev]); // add to top (or ...prev, newUser to bottom)
    setSelectedUser(newUser);              // open modal for the new user
    setModalKey((k) => k + 1);             // reset modal state
  };

  return (
    <div className="p-6 w-full">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-20">
          <h1 className="text-2xl font-bold text-center text-logoblue">
            Booking Users
          </h1>
        </div>

        <div className="justify-self-end">
          <button
            onClick={addUser}
            className="btn bg-logoblue py-1 px-4 rounded-4xl mb-4 font-semibold text-white cursor-pointer hover:opacity-80 transition-opacity"
          >
            Add User
          </button>
        </div>

        <UserTable
          users={users}
          onRowClick={(user) => {
            setSelectedUser(user);
            setModalKey((k) => k + 1);
          }}
        />

        <EditUserModal
          key={modalKey}
          isOpen={selectedUser !== null}
          onClose={closeModal}
          onSave={({ name, company, email, number, info, role, priceList, active }) => {
            if (!selectedUser) return;

            setUsers((prev) =>
              prev.map((u) =>
                u.id === selectedUser.id
                  ? { ...u, name, company, email, number, info, role, priceList, active }
                  : u
              )
            );

            setSelectedUser((prev) =>
              prev ? { ...prev, name, company, email, number, info, role, priceList, active } : prev
            );
            
          }}
          onRemove={() => {
            if (!selectedUser) return;
            setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
            setSelectedUser(null);
          }}
          onToggleActive={() => {
            if (!selectedUser) return;
            setUsers((prev) =>
              prev.map((u) =>
                u.id === selectedUser.id ? { ...u, active: !u.active } : u
              )
            );
            setSelectedUser((prev) => (prev ? { ...prev, active: !prev.active } : prev));
          }}
          initialValueName={selectedUser?.name ?? ""}
          initialValueCompany={selectedUser?.company ?? ""}
          initialValueEmail={selectedUser?.email ?? ""}
          initialValueNumber={selectedUser?.number ?? ""}
          initialValueInfo={selectedUser?.info ?? ""}
          initialValueRole={selectedUser?.role ?? ""}
          initialValuePriceList={selectedUser?.priceList ?? ""}
          initialValueActive={selectedUser?.active ?? true}
        />
      </div>
    </div>
  );
}