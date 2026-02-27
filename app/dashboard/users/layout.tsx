"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import  Sidebar  from "@/app/_components/Dahsboard/Sidebar";

const SIDEBAR_OPEN = 300;
const SIDEBAR_CLOSED = 44;

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const sidebarW = sidebarOpen ? SIDEBAR_OPEN : SIDEBAR_CLOSED;

  return (
    <>
        <div className="hidden lg:flex min-h-screen overflow-x-clip">
          {/*PC*/}
          <aside className="">
            <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} width={sidebarW}/>
          </aside>
          <main className="flex-1 min-w-0 overflow-y-auto overflow-x-clip lg:pt-10">
            <div className="w-full px-4">{children}</div>
          </main>
        </div>
          {/*Phone*/}
        <div className="relative lg:hidden">
          <div className="absolute w-full z-10 h-[60]">
            <div className="flex ">
              <aside className={`bg-white shadow-md  ${sidebarOpen? "h-full" : "h-[44]"}`}>
                <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} width={sidebarW}/>
              </aside>

            </div>
          </div>    
          <main className="flex-1 min-w-0 overflow-y-auto overflow-x-clip">
            <div className="w-full px-4 mt-[60]">{children}</div>
          </main>
        </div>
        </>
  );
}