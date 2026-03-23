"use client"
import Image from "next/image";
import { useState } from "react";
import UserModal from "@/app/_components/Dahsboard/users/UserModal";

type User = {
  id: number;
  name: string;
  img: string;
  email: string;
  number: number;
  role: string;
  online: boolean;
  lastSeen: string;
  enabled: boolean;
};

const initialUsers: User[] = [
  { id: 1, name: "Ralfs Kolveits", img: "/logo.png", email: "r.kolveits@gmail.com", number: 93004023, role: "IT", online: true, lastSeen: "01.02.2026", enabled: true },
  { id: 2, name: "Janis Otmans", img: "/logo.png", email: "otmantrasnportAS@gmail.com", number: 99999999, role: "Owner", online: false, lastSeen: "00.00.0000", enabled: false },
];

export default function UserPage() {
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [open, setOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<typeof users[number] | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    //for filtering
    const [roleFilter, setRoleFilter] = useState<string>(""); // "" = all
    const [query, setQuery] = useState<string>("");

    const filteredUsers = users.filter((u) => {
    const roleOk = !roleFilter || u.role === roleFilter;

    const q = query.trim().toLowerCase();
    const queryOk =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        String(u.number).includes(q);

    return roleOk && queryOk;
    });
    //If i have filtered something, make sure selecting rows select visible
    const visibleIds = filteredUsers.map((u) => u.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
        
    return(
    <>
    <div className="max-w-[1500] mx-auto">
        <h1 className="text-2xl lg:text-4xl mb-20 font-semibold text-logoblue whitespace-nowrap">User management</h1>

        <div className="w-full ">
            <UserModal
                key={selectedUser?.id ?? "new"}
                isOpen={open}
                onClose={() => setOpen(false)}
                initialValueName={selectedUser?.name ?? ""}
                initialValueEmail={selectedUser?.email ?? ""}
                initialValueNumber={selectedUser?.number ?? 0}
                initialValueRole={selectedUser?.role ?? "select"}
                initialValueActive={selectedUser?.enabled ?? true}
                onSave={(data) => {
                    if (selectedUser) {
                    // edit existing
                    setUsers((prev) =>
                        prev.map((u) => u.id === selectedUser.id ? {
                                ...u,
                                name: data.name,
                                email: data.email,
                                number: data.number,
                                role: data.role,
                                enabled: data.active,
                            } : u ));

                    setSelectedUser((u) => u ? {
                            ...u,
                            name: data.name,
                            email: data.email,
                            number: data.number,
                            role: data.role,
                            enabled: data.active,
                            } : u);
                        } else {
                    // add new
                        const newUser = {
                            id: Date.now(),
                            name: data.name,
                            img: "/logo.png",
                            email: data.email,
                            number: data.number,
                            role: data.role,
                            online: false,
                            lastSeen: "",
                            enabled: data.active,
                        };

                    setUsers((prev) => [newUser, ...prev]);
                    setSelectedUser(newUser);
                    }

                    setOpen(false);
                }}
                onRemove={() => {
                    if (!selectedUser) return;
                    setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
                    setSelectedUser(null);
                    setOpen(false);
                }}
                onToggleActive={() => {
                    if (!selectedUser) return;

                    setUsers((prev) =>
                    prev.map((u) =>
                        u.id === selectedUser.id ? { ...u, enabled: !u.enabled } : u
                    )
                    );
                    setSelectedUser((u) => (u ? { ...u, enabled: !u.enabled } : u));
                }}
                />
            <div className="shadow-xs pb-2 flex">
                <div className=" whitespace-nowrap">
                    <select className="customInput mr-2 hover:bg-black/3 duration-200 cursor-pointer" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>Role
                        <option value="">Role</option>
                        <option value="Sales">Sales</option>
                        <option value="Driver">Driver</option>
                        <option value="IT">IT</option>
                        <option value="Owner">Sales</option>
                    </select>
                    <input className="customInput w-60" placeholder="Search name, email, number" value={query} onChange={(e) => setQuery(e.target.value)}/>
                </div>
                <div className="flex ml-auto"> 
                    <button className="customButtonDefault hover:bg-black/3! mr-2 hidden lg:block">Export</button>
                    <button className="customButtonDefault" onClick={() => {setSelectedUser(null); setOpen(true);}}>Add User</button>
                </div>
            </div>
            <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
                <table className="w-full border-y border-black/10">
                    <thead>
                        <tr className="border-y border-black/10 bg-black/3 text-left text-textColorSecond">
                            <th className="px-1 py-3 border-r border-black/3 font-medium whitespace-nowrap table-cell text-center"><input checked={allVisibleSelected} onChange={(e) => {if (e.target.checked) {setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));} else {setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));}}} onClick={(e) => e.stopPropagation()} type="checkbox"  className="h-4 w-4" aria-label="Select all"/></th>
                            <th className="px-4 py-3 border-r border-black/3 font-medium whitespace-nowrap">Full name</th>
                            <th className="px-4 py-3 border-r border-black/3 font-medium whitespace-nowrap">
                                <div className="flex items-center"><svg className="w-[26] h-[26] mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 13h3.439a.991.991 0 0 1 .908.6 3.978 3.978 0 0 0 7.306 0 .99.99 0 0 1 .908-.6H20M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6M4 13l2-9h12l2 9"/></svg>
                                    Email
                                </div>
                            </th>
                            <th className="px-4 py-3 border-r border-black/3 font-medium whitespace-nowrap ">
                                <div className="flex items-center"><svg className="w-[26] h-[26] mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M18.427 14.768 17.2 13.542a1.733 1.733 0 0 0-2.45 0l-.613.613a1.732 1.732 0 0 1-2.45 0l-1.838-1.84a1.735 1.735 0 0 1 0-2.452l.612-.613a1.735 1.735 0 0 0 0-2.452L9.237 5.572a1.6 1.6 0 0 0-2.45 0c-3.223 3.2-1.702 6.896 1.519 10.117 3.22 3.221 6.914 4.745 10.12 1.535a1.601 1.601 0 0 0 0-2.456Z"/></svg>
                                    Number
                                </div>
                            </th>
                            <th className="px-4 py-3 border-r border-black/3 font-medium whitespace-nowrap ">
                                <div className="flex items-center"><svg className="w-[26] h-[26] mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a8.949 8.949 0 0 0 4.951-1.488A3.987 3.987 0 0 0 13 16h-2a3.987 3.987 0 0 0-3.951 3.512A8.948 8.948 0 0 0 12 21Zm3-11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
                                    Role
                                </div>
                            </th>
                            <th className="px-4 py-3 border-r border-black/3 font-medium whitespace-nowrap ">
                                <div className="flex items-center"><svg className="w-[26] h-[26] mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1" d="M21 12c0 1.2-4.03 6-9 6s-9-4.8-9-6c0-1.2 4.03-6 9-6s9 4.8 9 6Z"/><path stroke="currentColor" strokeWidth="1" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
                                    Status
                                </div>
                            </th>
                            <th className="px-4 py-3 border-r  border-black/3 font-medium whitespace-nowrap ">
                                <div className="flex items-center"><svg className="w-[26] h-[26] mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 10h16m-8-3V4M7 7V4m10 3V4M5 20h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1Zm3-7h.01v.01H8V13Zm4 0h.01v.01H12V13Zm4 0h.01v.01H16V13Zm-8 4h.01v.01H8V17Zm4 0h.01v.01H12V17Zm4 0h.01v.01H16V17Z"/></svg>
                                    Last seen
                                </div>
                            </th>
                            <th className="px-4 py-3 font-medium whitespace-nowrap">
                                <div className="flex items-center"><svg className="w-[26] h-[26] mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 20a16.405 16.405 0 0 1-5.092-5.804A16.694 16.694 0 0 1 5 6.666L12 4l7 2.667a16.695 16.695 0 0 1-1.908 7.529A16.406 16.406 0 0 1 12 20Z"/></svg>
                                    Active
                                </div>
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredUsers.map((u) => (
                            <tr key={u.id} className={`cursor-pointer border-b border-black/10 hover:bg-black/2`} onClick={()=> {setSelectedUser(u); setOpen(true)}} >
                                <td className="text-center"><input type="checkbox" className="h-4 w-4" onChange={(e) => {setSelectedIds((prev) =>e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id));}} checked={selectedIds.includes(u.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select booking ${u.id}`}/></td>
                                <td className="px-4 py-2 border-r border-black/3 text-textColorThird font-semibold flex whitespace-nowrap items-center"><div className="h-[28] w-[28] rounded-full overflow-hidden mr-2 bg-fuchsia-50"><Image src={u.img === "/" ? "/logo.png" : u.img} alt="pic" width={50} height={50} className="inline"/></div>{u.name}</td>
                                <td className="px-4 py-2 border-r border-black/3 text-textColorThird font-semibold">{u.email}</td>
                                <td className="px-4 py-2 border-r border-black/3 text-textColorThird font-semibold">{u.number}</td>
                                <td className="px-4 py-2 border-r border-black/3 text-textColorThird font-semibold">{u.role}</td>
                                <td className="px-4 py-2 border-r border-black/3 text-textColorThird font-semibold">{u.online ? <div className="text-center flex rounded-lg border border-lineSecondary items-center pr-2 py-1 max-w-[90]"><div className="w-[10] h-[10] rounded-full bg-red-500 mx-2"></div><div className="text-center">Offline</div></div> : <div className="text-center flex rounded-lg border border-lineSecondary items-center pr-2 py-1 max-w-[90]"><div className="w-[10] h-[10] rounded-full bg-green-500 mx-2"></div><div className="text-center">Online</div></div>}</td>
                                <td className="px-4 py-2 h border-r border-black/3 text-textColorThird font-semibold"><div className="max-h-12 overflow-y-auto wrap-break-word pr-2">{u.lastSeen}</div></td>
                                <td className={`px-4 py-2 text-textColorThird font-semibold${ u.enabled ? "" : "text-red-600" }`}>{u.enabled ? "Active" : "Disabled"}</td>
                            </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
        </div>
    </div>
    </>
    )
}