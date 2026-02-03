import type { ReactNode } from "react";
import { Sidebar } from "../_components/(booking)/Sidebar";
import  TopFilters  from "../_components/(booking)/TopFilters"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* LEFT */}
      <aside className="w-[300px] shrink-0">
        <Sidebar />
      </aside>

      {/* RIGHT */}
      <section className="flex-1 flex flex-col min-w-0">
        {/* Filters */}
        <header className="border-b px-6 py-4">
          <TopFilters/>
        </header>

        {/* Archive */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </section>
    </div>
  );
}
