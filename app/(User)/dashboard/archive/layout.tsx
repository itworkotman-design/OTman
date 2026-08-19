"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Sidebar from "@/app/_components/Dahsboard/Sidebar";

const SIDEBAR_OPEN = 300;
const SIDEBAR_CLOSED = 50;

export default function ArchiveLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarOpenPhone, setSidebarOpenPhone] = useState(false);

  const sidebarW = sidebarOpen ? SIDEBAR_OPEN : SIDEBAR_CLOSED;

  return (
    <div className="min-h-screen overflow-x-clip">
      {/* Desktop sidebar — fixed so it stays in place while the page scrolls */}
      <aside className="hidden lg:block fixed top-0 left-0 z-30 h-screen" style={{ width: sidebarW }}>
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} width={sidebarW} />
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white shadow-md">
        <Sidebar open={sidebarOpenPhone} onOpenChange={setSidebarOpenPhone} width={""} lockBodyScrollWhenOpen />
      </div>

      <main
        className="content-shell min-h-screen overflow-y-auto overflow-x-clip"
        style={{ ["--sidebar-width" as string]: `${sidebarW}px`, ["--dash-sidebar-width" as string]: `${sidebarW}px` }}
      >
        <div className="mx-auto w-full max-w-4xl px-6 pt-[70] lg:max-w-[1600] lg:px-0 lg:pt-10">{children}</div>
      </main>

      <style jsx>{`
        .content-shell {
          padding-left: 0;
        }
        @media (min-width: 1024px) {
          .content-shell {
            padding-left: var(--sidebar-width);
          }
        }
      `}</style>
    </div>
  );
}
