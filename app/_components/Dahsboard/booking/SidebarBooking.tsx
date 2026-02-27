"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const SidebarBooking = ({ onNavigate }: { onNavigate: () => void }) => {
  const pathname = usePathname();

  const linkBase =
    "block max-w-[400px] w-full text-sm font-semibold px-4 py-2.5 rounded-lg mb-2 transition-colors";

  const isActive = (href: string) => pathname === href;

  return (
    <div className="w-full h-full pt-8 px-4 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1),2px_0_4px_-1px_rgba(0,0,0,0.01)] bg-white">
      {/* Logo */}
      <div className="flex justify-center">
        <Image src="/Logo.png" alt="Logo" width={200} height={200} />
      </div>

      {/* User */}
      <h1 className="text-center py-8 text-2xl font-bold">Username</h1>

      {/* Links */}
      <Link
        href="/dashboard/booking"
        onClick={onNavigate}
        className={`${linkBase} ${
          isActive("/dashboard/booking")
            ? "bg-logoblue text-white"
            : "bg-transparent text-logoblue hover:bg-logoblue/10"
        }`}
      >
        All orders
      </Link>

      <Link
        href="/dashboard/booking/create"
        onClick={onNavigate}
        className={`${linkBase} ${
          isActive("/dashboard/booking/create")
            ? "bg-logoblue text-white"
            : "bg-transparent text-logoblue hover:bg-logoblue/10"
        }`}
      >
        Create order
      </Link>

      <Link
        href="/dashboard/booking/power"
        onClick={onNavigate}
        className={`${linkBase} ${
          isActive("/dashboard/booking/power")
            ? "bg-logoblue text-white"
            : "bg-transparent text-logoblue hover:bg-logoblue/10"
        }`}
      >
        Create Power order
      </Link>

      <Link
        href="/dashboard/booking/booking_users"
        onClick={onNavigate}
        className={`${linkBase} ${
          isActive("/dashboard/booking/booking_users")
            ? "bg-logoblue text-white"
            : "bg-transparent text-logoblue hover:bg-logoblue/10"
        }`}
      >
        Booking users
      </Link>

      <Link
        href="/dashboard/booking/editPrices"
        onClick={onNavigate}
        className={`${linkBase} ${
          isActive("/dashboard/booking/editPrices")
            ? "bg-logoblue text-white"
            : "bg-transparent text-logoblue hover:bg-logoblue/10"
        }`}
      >
        Edit Prices
      </Link>

      <Link
        href=""
        onClick={onNavigate}
        className={`${linkBase} text-logoblue hover:bg-logoblue/10`}
      >
        Log out
      </Link>
    </div>
  );
};
