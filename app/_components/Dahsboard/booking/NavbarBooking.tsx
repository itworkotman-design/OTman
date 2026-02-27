"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const NavbarBooking = ({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) => {
  const pathname = usePathname();

  const isExact = (path: string) => pathname === path;
  const isStarts = (path: string) => pathname.startsWith(path);

  return (
    <>
      {/* Mobile */}
      <div className="lg:hidden w-full relative mb-6">
        <button
          type="button"
          onClick={onToggle}
          className="w-full py-auto h-[60] text-center font-semibold shadow-md bg-mainPrimary lg:rounded-b-2xl text-logoblue"
        >
          Navbar
        </button>

        <div
          className={[
            "absolute left-0 top-full w-full bg-white z-50 shadow-md overflow-hidden",
            open ? "py-6 rounded-b-2xl" : "max-h-0",
          ].join(" ")}
        >
          <div className="flex flex-col items-start gap-8 text-xl mx-5">
            <NavLinks isExact={isExact} isStarts={isStarts} />
          </div>
        </div>
      </div>

      {/* Desktop */}
      <nav className="hidden lg:flex w-full lg:max-w-160 relative lg:left-1/2 lg:-translate-x-1/2 lg:py-4 lg:gap-6 shadow-md justify-center mb-8 rounded-b-2xl bg-white">
        <NavLinks isExact={isExact} isStarts={isStarts} />
      </nav>
    </>
  );
};

function NavLinks({
  isExact,
  isStarts,
}: {
  isExact: (p: string) => boolean;
  isStarts: (p: string) => boolean;
}) {
  const base = "px-3 text-neutral-500 hover:text-textcolor";
  const active = "text-logoblue! font-semibold";

  return (
    <>
      <Link
        href="/dashboard/booking"
        className={`${base} ${isExact("/dashboard/booking") ? active : ""}`}
      >
        All orders
      </Link>

      <Link
        href="/dashboard/booking/create"
        className={`${base} ${isStarts("/dashboard/booking/create") ? active : ""}`}
      >
        Create order
      </Link>

      <Link
        href="/dashboard/booking/power"
        className={`${base} ${isStarts("/dashboard/booking/power") ? active : ""}`}
      >
        Power order
      </Link>

      <Link
        href="/dashboard/booking/editPrices"
        className={`${base} ${isStarts("/dashboard/booking/editPrices") ? active : ""}`}
      >
        Edit prices
      </Link>

      <Link
        href="/dashboard/booking/booking_users"
        className={`${base} ${isStarts("/dashboard/booking/booking_users") ? active : ""}`}
      >
        Edit users
      </Link>
    </>
  );
}