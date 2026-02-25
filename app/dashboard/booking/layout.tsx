"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Sidebar } from "../../_components/Dahsboard/booking/Sidebar";
import { Navbar } from "@/app/_components/Dahsboard/Navbar";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const openSidebar = () => {
    setSidebarOpen(true);
    setNavOpen(false);
  };
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen flex overflow-x-clip">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-75 shrink-0 z-10">
        <Sidebar onNavigate={() => {}} />
      </aside>

      {/* Mobile sidebar drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-50 ${sidebarOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!sidebarOpen}
      >
        <div
          onClick={closeSidebar}
          className={`absolute inset-0 bg-black/40 transition-opacity ${sidebarOpen ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`absolute left-0 top-0 h-full w-[82vw] max-w-xs bg-white shadow-xl transition-transform ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          role="dialog"
          aria-modal="true"
        >

          <div className="h-[calc(100%-52px)] overflow-auto">
            <Sidebar onNavigate={closeSidebar} />
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-clip">
        <div className="flex">
          <button
            type="button"
            onClick={openSidebar}
            className="lg:hidden bg-white px-6 h-[60] text-md font-semibold shadow-md text-logoblue"
          >
            Menu
          </button>

          <Navbar
            open={navOpen}
            onToggle={() => {
              setNavOpen((p) => !p);
              setSidebarOpen(false);
            }}
          />
        </div>

        <div className="w-full px-4">{children}</div>
      </main>
    </div>
  );
}