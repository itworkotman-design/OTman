"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Sidebar from "@/app/_components/Dahsboard/Sidebar";

const SIDEBAR_OPEN = 300;
const SIDEBAR_CLOSED = 50;

export default function WebsiteEditorLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarOpenPhone, setSidebarOpenPhone] = useState(false);

  const sidebarW = sidebarOpen ? SIDEBAR_OPEN : SIDEBAR_CLOSED;

  return (
    <>
      {/* PC */}
      <div className="hidden min-h-screen overflow-x-clip lg:flex">
        <aside>
          <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} width={sidebarW} />
        </aside>
        <main className="flex w-full">
          <div className="w-full">{children}</div>
        </main>
      </div>

      {/* Phone */}
      <div className="lg:hidden">
        <div className="fixed z-10 w-full">
          <div className="w-full bg-white shadow-md">
            <div className={sidebarOpenPhone ? "h-full pb-10" : "ml-auto w-11"}>
              <Sidebar open={sidebarOpenPhone} onOpenChange={setSidebarOpenPhone} width={""} />
            </div>
          </div>
        </div>
        <main className="overflow-x-clip">
          <div className="w-full pt-[60]">{children}</div>
        </main>
      </div>
    </>
  );
}
