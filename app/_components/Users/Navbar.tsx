"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/users/useCurrentUser";

type Props = {
  open: boolean;
  width: number | string;
  onOpenChange: (v: boolean) => void;
};

// ─── Icon paths ───────────────────────────────────────────────────────────────

const ICONS = {
  booking:
    "M13 7h6l2 4m-8-4v8m0-8V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v9h2m8 0H9m4 0h2m4 0h2v-4m0 0h-5m3.5 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm-10 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
  createOrder:
    "M12 20a16.405 16.405 0 0 1-5.092-5.804A16.694 16.694 0 0 1 5 6.666L12 4l7 2.667a16.695 16.695 0 0 1-1.908 7.529A16.406 16.406 0 0 1 12 20Z",
  sidebarOpen:
    "M8.99994 10 7 11.9999l1.99994 2M12 5v14M5 4h14c.5523 0 1 .44772 1 1v14c0 .5523-.4477 1-1 1H5c-.55228 0-1-.4477-1-1V5c0-.55228.44772-1 1-1Z",
  sidebarClose:
    "m7 10 1.99994 1.9999-1.99994 2M12 5v14M5 4h14c.5523 0 1 .44772 1 1v14c0 .5523-.4477 1-1 1H5c-.55228 0-1-.4477-1-1V5c0-.55228.44772-1 1-1Z",
  hamburger: "M5 7h14M5 12h14M5 17h14",
};

function Icon({ path }: { path: string }) {
  return (
    <svg
      className="mr-2 h-[24] w-[24] shrink-0"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
        d={path}
      />
    </svg>
  );
}

// ─── UserNavbar ───────────────────────────────────────────────────────────────

export default function UserNavbar({ open, width, onOpenChange }: Props) {
  const currentUser = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/booking"
      ? pathname === "/booking"
      : pathname.startsWith(href);

  const linkBase =
    "block max-w-[400px] w-full text-sm font-[500] px-2 py-2.5 rounded-lg mb-2 transition-colors text-textColorSecond";

  const linkClass = (href: string) =>
    `${linkBase} ${
      isActive(href)
        ? "bg-linePrimary text-textcolor"
        : "bg-transparent hover:bg-linePrimary"
    }`;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div style={{ width }} className={`h-full lg:bg-linePrimary ${open ? "w-full" : "w-10"}`}>
      <div className="flex py-4">
        {/* Desktop toggle */}
        <button
          onClick={() => onOpenChange(!open)}
          className="ml-auto hidden cursor-pointer px-2 hover:text-textcolor lg:block"
        >
          <Icon path={open ? ICONS.sidebarOpen : ICONS.sidebarClose} />
        </button>

        {/* Mobile toggle */}
        <button
          onClick={() => onOpenChange(!open)}
          className="mx-auto cursor-pointer hover:text-textcolor lg:hidden"
        >
          <Icon path={ICONS.hamburger} />
        </button>
      </div>

      <div className={open ? "" : "hidden"}>
        <div className="flex justify-center">
          <Image src="/LogoSVG.svg" alt="Logo" width={200} height={200} />
        </div>

        <div className="px-4">
          <div className="mt-6 flex border-b border-lineSecondary px-2 py-1 pb-6 text-logoblue">
            <h1 className="mx-auto">{currentUser?.email ?? ""}</h1>
          </div>

          <Link href="/booking" className={linkClass("/booking")}>
            <div className="flex items-center">
              <Icon path={ICONS.booking} />
              Orders
            </div>
          </Link>

          <Link href="/booking/create" className={linkClass("/booking/create")}>
            <div className="flex items-center">
              <Icon path={ICONS.createOrder} />
              Create Order
            </div>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className={`${linkBase} cursor-pointer text-left hover:bg-linePrimary`}
          >
            <div className="flex items-center">Log out</div>
          </button>
        </div>
      </div>
    </div>
  );
}