import type { ReactNode } from "react";


export default function createLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen ">
        <main className="w-full flex">
            <div className="grow">
                {children}
            </div>
            <div>
              
            </div>
        </main>
          
    </div>
  );
}
