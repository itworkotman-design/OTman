import type { ReactNode } from "react";
import { Sidebar } from "../../_components/(booking)/Sidebar";
import { Navbar } from "@/app/_components/(Dahsboard)/Navbar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* LEFT */}
      <aside className="w-75 shrink-0 z-10">
        <Sidebar />
      </aside>

      {/* RIGHT */}
        <main className="flex-1 overflow-auto px-4">
          <div className="sticky z-10" >
            <Navbar/>
          </div>
          {children}
        </main>
    </div>
  );
}
