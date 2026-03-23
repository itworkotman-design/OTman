"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import  Sidebar  from "@/app/_components/Dahsboard/Sidebar";

const SIDEBAR_OPEN = 300;
const SIDEBAR_CLOSED = 50;

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarOpenPhone, setSidebarOpenPhone] = useState(false);

  const sidebarW = sidebarOpen ? SIDEBAR_OPEN : SIDEBAR_CLOSED;

  return (
    <>
        <div className="hidden lg:flex min-h-screen overflow-x-clip">
          {/*PC*/}
          <aside className="">
            <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} width={sidebarW}/>
          </aside>
          <main className="lg:pt-10 w-full flex">
            <div className="px-4 w-full">{children}</div>
          </main>
        </div>
          {/*Phone*/}
        <div className="lg:hidden">
          <div className="fixed w-full z-10">
            <div className={`bg-white shadow-md w-full`}>
              <div className={` ${sidebarOpenPhone? "h-full pb-10": "ml-auto w-11"}`}>
                <Sidebar open={sidebarOpenPhone} onOpenChange={setSidebarOpenPhone} width={""}/>
              </div>
            </div>
          </div>    
          <main className="overflow-x-clip">
            <div className="w-full px-4 pt-[60]">{children}</div>
          </main>
        </div>
        </>
  );
}