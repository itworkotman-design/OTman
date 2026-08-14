"use client"
import { useState } from "react";
import Sidebar from "../../_components/Dahsboard/Sidebar";
import DashboardHome from "@/app/_components/Dahsboard/home/DashboardHome";

const SIDEBAR_OPEN = 300;
const SIDEBAR_CLOSED = 50;

export default function Dashboard() {

    const [sidebarOpen, setSidebarOpen] = useState(true);
      const [sidebarOpenPhone, setSidebarOpenPhone] = useState(false);
      const sidebarW = sidebarOpen ? SIDEBAR_OPEN : SIDEBAR_CLOSED;

    return (
      <>
        <div className="hidden lg:flex min-h-screen overflow-x-clip">
          {/*PC*/}
          <aside className="">
            <Sidebar
              open={sidebarOpen}
              onOpenChange={setSidebarOpen}
              width={sidebarW}
            />
          </aside>
          <main className="lg:pt-10 w-full flex">
            <div className="px-4 w-full">
              <DashboardHome />
            </div>
          </main>
        </div>
        {/*Phone*/}
        <div className="lg:hidden">
          <div className="fixed w-full z-10">
            <div className={`bg-white shadow-md w-full`}>
              <div className="w-full">
                <Sidebar
                  open={sidebarOpenPhone}
                  onOpenChange={setSidebarOpenPhone}
                  width={""}
                  lockBodyScrollWhenOpen
                />
              </div>
            </div>
          </div>
          <main className="overflow-x-clip">
            <div className="w-full px-4 pt-[60]">
              <DashboardHome />
            </div>
          </main>
        </div>
      </>
    );
    
}