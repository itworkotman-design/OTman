"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import  Sidebar  from "../../_components/Dahsboard/Sidebar";
import { NavbarBooking } from "@/app/_components/Dahsboard/booking/NavbarBooking";

const SIDEBAR_OPEN = 300;
const SIDEBAR_CLOSED = 50;

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarOpenPhone, setSidebarOpenPhone] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const sidebarW = sidebarOpen ? SIDEBAR_OPEN : SIDEBAR_CLOSED;
  const sidebarWPhone = sidebarOpenPhone ? SIDEBAR_OPEN : SIDEBAR_CLOSED;

  return (
    <>
    <div className="hidden lg:flex min-h-screen overflow-x-clip">
      {/*PC*/}
      <aside className="">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} width={sidebarW}/>
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-clip">
        <div className="flex">
          <NavbarBooking open={navOpen} onToggle={() => {setNavOpen((p) => !p);setSidebarOpen(false);}} onClose={() => setNavOpen(false)}/>
        </div>

        <div className="w-full px-4">{children}</div>
      </main>
    </div>
      {/*Phone*/}
    <div className="relative lg:hidden">
      <div className="fixed w-full z-10 ">
        <div className="flex ">
          <aside className={`bg-white shadow-md  ${sidebarOpenPhone? "h-dvh" : "h-[60]"}`}>
            <Sidebar open={sidebarOpenPhone} onOpenChange={setSidebarOpenPhone} width={sidebarWPhone}/>
          </aside>
          <div className="flex grow">
            <NavbarBooking open={navOpen} onToggle={() => {setNavOpen((p) => !p);setSidebarOpenPhone(false);}} onClose={() => setNavOpen(false)}/>
          </div>
        </div>
      </div>    
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-clip pt-2">
        <div className="w-full px-4 mt-[60]">{children}</div>
      </main>
    </div>
    </>
  );
}