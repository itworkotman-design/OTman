"use client";

import type { User } from "@/app/dashboard/booking/booking_users/_types/user.ts";

export function UserTable({
  users,
  onRowClick,
}: {
  users: User[];
  onRowClick: (u: User) => void;
}) {
  return (
    <table className="w-full table-fixed border border-black/10">
      <thead>
        <tr>
          <th className="px-4 py-4 border bg-logoblue text-white font-semibold w-40">Name</th>
          <th className="hidden min-[500]:table-cell px-4 py-4 border bg-logoblue text-white font-semibold w-50">Email</th>
          <th className="hidden min-[1200]:table-cell px-4 py-4 border bg-logoblue text-white font-semibold w-40">Company</th>
          <th className="hidden min-[1400]:table-cell px-4 py-4 border bg-logoblue text-white font-semibold w-40">Number</th>
          <th className="hidden min-[620]:table-cell px-4 py-4 border bg-logoblue text-white font-semibold w-30">Role</th>
          <th className="hidden min-[1600]:table-cell px-4 py-4 border bg-logoblue text-white font-semibold w-30">Price List</th>
          <th className="hidden min-[1800]:table-cell px-4 py-4 border bg-logoblue text-white font-semibold w-auto">Info</th>
          <th className="hidden min-[1900]:table-cell px-4 py-4 border bg-logoblue text-white font-semibold w-20">Posts</th>
          <th className=" px-4 py-4 border bg-logoblue text-white font-semibold w-20">Active</th>
        </tr>
      </thead>

      <tbody>
        {users.map((u) => {
          const rowMuted = !u.active ? "text-black/20" : "";

          return (
            <tr key={u.id} onClick={() => onRowClick(u)} className={`cursor-pointer border-b border-black/10 hover:bg-black/2 ${rowMuted}`} >
              <td className="px-2 py-2">{u.name}</td>
              <td className="hidden min-[500]:table-cell px-2 py-2">{u.email}</td>
              <td className="hidden min-[1200]:table-cell px-2 py-2">{u.company}</td>
              <td className="hidden min-[1400]:table-cell px-2 py-2">{u.number}</td>
              <td className="hidden min-[620]:table-cell px-2 py-2">{u.role}</td>
              <td className="hidden min-[1600]:table-cell px-2 py-2">{u.priceList}</td>
              <td className="hidden min-[1800]:table-cell px-2 py-2 align-top"><div className="max-h-12 overflow-y-auto wrap-break-word pr-2">{u.info}</div></td>
              <td className="hidden min-[1900]:table-cell px-2 py-2">1234</td>
              <td className={`px-2 py-2 ${ u.active ? "" : "text-red-600" }`}>{u.active ? "Active" : "Disabled"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
