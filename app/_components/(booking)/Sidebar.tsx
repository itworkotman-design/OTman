"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const Sidebar = () => {
  const pathname = usePathname();

  const linkBase =
    "block max-w-[400px] w-full text-sm font-semibold px-4 py-2.5 rounded-lg mb-2 transition-colors";

  const isActive = (href: string) => pathname === href;

  return (
    <div className="w-full  pt-8 px-4 min-h-screen shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1),2px_0_4px_-1px_rgba(0,0,0,0.01)]">
      {/* Logo */}
      <div className="flex justify-center">
        <Image src="/Logo.png" alt="Logo" width={200} height={200} />
      </div>

      {/* User */}
      <h1 className="text-center py-8 text-2xl font-bold">Username</h1>

      {/* Links */}
      <Link
        href="/booking"
        className={`${linkBase} ${
          isActive("/booking")
            ? "bg-logoblue text-white"
            : "bg-transparent text-logoblue hover:bg-logoblue/10"
        }`}
      >
        All orders
      </Link>

      <Link
        href="/booking/create"
        className={`${linkBase} ${
          isActive("/booking/create")
            ? "bg-logoblue text-white"
            : "bg-transparent text-logoblue hover:bg-logoblue/10"
        }`}
      >
        Create order
      </Link>

      <Link
        href="/booking/power"
        className={`${linkBase} ${
          isActive("/booking/power")
            ? "bg-logoblue text-white"
            : "bg-transparent text-logoblue hover:bg-logoblue/10"
        }`}
      >
        Create Power order
      </Link>

      <Link
        href="/booking/users"
        className={`${linkBase} ${
          isActive("/booking/users")
            ? "bg-logoblue text-white"
            : "bg-transparent text-logoblue hover:bg-logoblue/10"
        }`}
      >
        Users
      </Link>

      <Link
        href="/booking/editPrices"
        className={`${linkBase} ${
          isActive("/booking/editPrices")
            ? "bg-logoblue text-white"
            : "bg-transparent text-logoblue hover:bg-logoblue/10"
        }`}
      >
        Edit Prices
      </Link>

      <Link
        href=""
        className={`${linkBase} text-logoblue hover:bg-logoblue/10`}
      >
        Log out
      </Link>
    </div>
  );
};
