"use client";

import { useMemo, useState } from "react";
import { User } from "@/app/dashboard/booking/booking_users/_types/user";
import { UserTable } from "@/app/_components/(booking)/users/UserTable";
import { EditUserModal } from "@/app/_components/(booking)/users/EditUserModal";

export default function UserPage() {
  const users: User[] = useMemo(
    () => [
      {
        id: 1,
        name: "Janis Otmanis",
        email: "lalala@otman.no",
        company: "OtmanTransportAS",
        number: "+47 000 00 000",
        role: "Admin",
        info: "Business owner, works here",
        disabled: false,
      },
      {
        id: 2,
        name: "Test User",
        email: "test@otman.no",
        company: "OtmanTransportAS",
        number: "+47 111 11 111",
        role: "User",
        info: "Support",
        disabled: true,
      },
    ],
    []
  );

  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  return (
    <div className="flex flex-col">
      <h1 className="text-4xl font-semibold text-logoblue mb-8 text-center">
        Booking Users
      </h1>

      <div className="max-w-420 mx-auto">
        <UserTable users={users} onRowClick={setSelectedUser} />
      </div>

      <EditUserModal
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onSave={(updated: unknown) => {
          // later: call API + refresh list
          console.log("save", updated);
          setSelectedUser(null);
        }}
      />
    </div>
  );
}
