import type { ReactNode } from "react";
import { Sidebar } from "../_components/(booking)/Sidebar";
import  TopFilters  from "../_components/(booking)/TopFiltersField"
import { BookingFieldEditor } from "../_components/(booking)/BookingFieldEditor";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* LEFT */}
      <aside className="w-75 shrink-0">
        <Sidebar />
      </aside>

      {/* RIGHT */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
    </div>
  );
}
