"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

export const Navbar = () => {
  const pathname = usePathname()

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <>
      <nav className="w-full max-w-160 relative left-1/2 -translate-x-1/2 py-4 flex gap-6 shadow-md justify-center mb-8 rounded-b-2xl bg-white">
        <Link href="/dashboard/booking" className={`block px-3 transition-colors duration-140 hover:text-textcolor text-neutral-500 ${isActive("/dashboard/booking")? "text-logoblue! font-semibold":""}`}>
            Booking
        </Link>
        <Link href="/dashboard/users" className={`block px-3 transition-colors duration-140 hover:text-textcolor text-neutral-500 ${isActive("/dashboard/users")? "text-logoblue! font-semibold":""}`}>
            Future : Users
        </Link>
        <Link href="/dashboard/inventory" className={`block px-3 transition-colors duration-140 hover:text-textcolor text-neutral-500 ${isActive("/dashboard/inventory")? "text-logoblue! font-semibold":""}`}>
            Future : Inventory
        </Link>
        <Link href="/dashboard/legal" className={`block px-3 transition-colors duration-140 hover:text-textcolor text-neutral-500 ${isActive("/dashboard/legal")? "text-logoblue! font-semibold":""}`}>
            Future : Legal
        </Link>
      </nav>
    </>
  )
}