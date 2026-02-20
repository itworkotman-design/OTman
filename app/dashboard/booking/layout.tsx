import type { ReactNode } from "react";
import { Sidebar } from "../../_components/Dahsboard/booking/Sidebar";
import { Navbar } from "@/app/_components/Dahsboard/Navbar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex overflow-hidden">
  <aside className="w-75 shrink-0 z-10">
    <Sidebar />
  </aside>

  <main className="flex-1 min-w-0 overflow-auto px-4">
    <Navbar />
    <div className="w-full">
      {children}
    </div>
  </main>
</div>
  );
}
