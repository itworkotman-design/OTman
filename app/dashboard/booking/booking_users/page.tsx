"use client";

import { useState } from "react";
import EditUserModal from "@/app/_components/(booking)/users/EditUserModal";
import type { User } from "./_types/user";
import { UserTable } from "@/app/_components/(booking)/users/UserTable";

export default function UserPage() {
  const [users, setUsers] = useState<User[]>([
    {
      id: "1",
      name: "John Doe",
      email: "john@example.com",
      company: "Acme",
      number: "12345678",
      role: "Admin",
      info: "Main contact person",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane@example.com",
      company: "Beta AS",
      number: "87654321",
      role: "User",
      info: "Handles support requests",
    },
  ]);

  // open/close the modal
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // forces modal remount so its internal state resets from initialValue props
  const [modalKey, setModalKey] = useState(0);

  const closeModal = () => setSelectedUser(null);

  return (
    <div className="p-6">
      <UserTable users={users} onRowClick={(user) => {
          setSelectedUser(user);
          setModalKey((k) => k + 1)}}/>

      <EditUserModal key={modalKey} isOpen={selectedUser !== null} onClose={closeModal} onSave={({ name, company, email, number, info, role }) => {
        if (!selectedUser) return;

        setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, name, company, email, number, info, role }: u));

        // keep the open modal consistent after save
        setSelectedUser((prev) => prev ? { ...prev, name, company, email, number, info, role } : prev )}}
        initialValueName={selectedUser?.name ?? ""}
        initialValueCompany={selectedUser?.company ?? ""}
        initialValueEmail={selectedUser?.email ?? ""}
        initialValueNumber={selectedUser?.number ?? ""}
        initialValueInfo={selectedUser?.info ?? ""}
        initialValueRole={selectedUser?.role ?? ""}
      />
    </div>
  );
}
