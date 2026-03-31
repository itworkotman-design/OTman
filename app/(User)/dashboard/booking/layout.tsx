"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Sidebar from "../../../_components/Dahsboard/Sidebar";
import { NavbarBooking } from "@/app/_components/Dahsboard/booking/NavbarBooking";

const SIDEBAR_OPEN = 300;
const SIDEBAR_CLOSED = 50;
const TOPBAR_HEIGHT = 60;

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarOpenPhone, setSidebarOpenPhone] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const sidebarW = sidebarOpen ? SIDEBAR_OPEN : SIDEBAR_CLOSED;
  const sidebarWPhone = sidebarOpenPhone ? SIDEBAR_OPEN : SIDEBAR_CLOSED;

  return (
    <div className="min-h-screen overflow-x-clip bg-white">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:block fixed top-0 left-0 z-30 h-screen"
        style={{ width: `${sidebarW}px` }}
      >
        <Sidebar
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          width={sidebarW}
        />
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-[60] bg-white">
        <div className="relative h-full w-full">
          {/* Mobile overlay sidebar */}
          <div className="absolute top-0 left-0 z-50">
            <aside
              className={`bg-white shadow-md ${
                sidebarOpenPhone ? "h-dvh" : "h-[60]"
              }`}
              style={{ width: `${sidebarWPhone}px` }}
            >
              <Sidebar
                open={sidebarOpenPhone}
                onOpenChange={setSidebarOpenPhone}
                width={sidebarWPhone}
              />
            </aside>
          </div>

          {/* Mobile navbar stays full width underneath */}
          <div className="h-full w-full">
            <NavbarBooking
              open={navOpen}
              onToggle={() => {
                setNavOpen((p) => !p);
                setSidebarOpenPhone(false);
              }}
              onClose={() => setNavOpen(false)}
            />
          </div>
        </div>
      </div>

      {/* Desktop navbar */}
      <div
        className="hidden lg:block fixed top-0 right-0 z-20"
        style={{
          left: `${sidebarW}px`,
          height: `${TOPBAR_HEIGHT}px`,
        }}
      >
        <NavbarBooking
          open={navOpen}
          onToggle={() => {
            setNavOpen((p) => !p);
            setSidebarOpen(false);
          }}
          onClose={() => setNavOpen(false)}
        />
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
          padding-top: var(--topbar-height);
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
