"use client"
import Link from "next/link"
import { useState } from "react";
import { usePathname } from "next/navigation"

export const Navbar = ({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) => {
  const pathname = usePathname()
  const isActive = (path: string) => pathname.startsWith(path);

 return (
    <>
      {/* Mobile */}
      <div className="lg:hidden w-full relative mb-6">
        <button type="button" onClick={onToggle} className="w-full py-auto h-[60] text-center font-semibold shadow-md bg-white lg:rounded-b-2xl text-logoblue" >Navbar</button>
        <div className={[ "absolute left-0 top-full w-full bg-white z-50 shadow-md overflow-hidden ", open ? "py-6 rounded-b-2xl" : "max-h-0", ].join(" ")} >
          <div className="flex flex-col items-start gap-8 text-xl  mx-5">
            <NavLinks isActive={isActive}/>
          </div>
        </div>
      </div>

      {/* Desktop */}
      <nav className="hidden lg:flex w-full lg:max-w-160 relative lg:left-1/2 lg:-translate-x-1/2 lg:py-4 lg:gap-6 shadow-md justify-center mb-8 rounded-b-2xl bg-white">
        <NavLinks isActive={isActive}/>
      </nav>
    </>
  );
}

function NavLinks({ isActive }: { isActive: (p: string) => boolean }) {
  return (
    <>
      <Link href="/dashboard/booking" className={`px-3 text-neutral-500 hover:text-textcolor ${isActive("/dashboard/booking") ? " text-logoblue! font-semibold" : ""}`}>
        Booking
      </Link>
      <Link href="/dashboard/users" className={`px-3 text-neutral-500 hover:text-textcolor ${isActive("/dashboard/users") ? "text-logoblue! font-semibold" : ""}`}>
        Future : Users
      </Link>
      <Link href="/dashboard/inventory" className={`px-3 text-neutral-500 hover:text-textcolor ${isActive("/dashboard/inventory") ? "text-logoblue! font-semibold" : ""}`}>
        Future : Inventory
      </Link>
      <Link href="/dashboard/legal" className={`px-3 text-neutral-500 hover:text-textcolor ${isActive("/dashboard/legal") ? "text-logoblue! font-semibold" : ""}`}>
        Future : Legal
      </Link>
    </>
  );
}