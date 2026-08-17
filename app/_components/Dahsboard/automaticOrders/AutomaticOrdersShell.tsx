"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Sidebar from "@/app/_components/Dahsboard/Sidebar";

const SIDEBAR_OPEN = 300;
const SIDEBAR_CLOSED = 50;
const TOPBAR_HEIGHT = 60;

// Same Sidebar + content shell as dashboard/booking/layout.tsx — the
// "Scheduler orders" nav entry lives as a top-level button under Sidebar's
// "Booking app" section at every width (see Sidebar.tsx); there's no
// separate NavbarBooking top bar anymore.
export default function AutomaticOrdersShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarOpenPhone, setSidebarOpenPhone] = useState(false);

  const sidebarW = sidebarOpen ? SIDEBAR_OPEN : SIDEBAR_CLOSED;

  return (
    <div className="min-h-screen overflow-x-clip bg-white">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:block fixed top-0 left-0 z-30 h-screen"
        style={{ width: sidebarW }}
      >
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} width={sidebarW} />
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white shadow-md">
        <Sidebar open={sidebarOpenPhone} onOpenChange={setSidebarOpenPhone} width={""} lockBodyScrollWhenOpen />
      </div>

      {/* Shared content */}
      <main
        className="content-shell min-h-screen overflow-y-auto overflow-x-clip"
        style={
          {
            "--sidebar-width": `${sidebarW}px`,
            "--topbar-height": `${TOPBAR_HEIGHT}px`,
          } as React.CSSProperties
        }
      >
        <div className="w-full px-4">{children}</div>
      </main>

      <style jsx>{`
        .content-shell {
          padding-top: calc(var(--topbar-height) + 10px);
          padding-left: 0;
        }

        @media (min-width: 1024px) {
          .content-shell {
            padding-top: 40px;
            padding-left: var(--sidebar-width);
          }
        }
      `}</style>
    </div>
  );
}
