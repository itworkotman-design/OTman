"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import FeatureRequestModal from "@/app/_components/Dahsboard/FeatureRequestModal";

type Props = {
  open: boolean;
  width: number | string;
  onOpenChange: (v: boolean) => void;
};

// ─── Icon component ───────────────────────────────────────────────────────────

function Icon({ path, path2 }: { path: string; path2?: string }) {
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
      {path2 && (
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1"
          d={path2}
        />
      )}
    </svg>
  );
}

// ─── Icon paths ───────────────────────────────────────────────────────────────

const ICONS = {
  home: "m4 12 8-8 8 8M6 10.5V19a1 1 0 0 0 1 1h3v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h3a1 1 0 0 0 1-1v-8.5",
  booking:
    "M13 7h6l2 4m-8-4v8m0-8V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v9h2m8 0H9m4 0h2m4 0h2v-4m0 0h-5m3.5 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm-10 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
  users:
    "M16 19h4a1 1 0 0 0 1-1v-1a3 3 0 0 0-3-3h-2m-2.236-4a3 3 0 1 0 0-4M3 18v-1a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Zm8-10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  sidebarOpen:
    "M8.99994 10 7 11.9999l1.99994 2M12 5v14M5 4h14c.5523 0 1 .44772 1 1v14c0 .5523-.4477 1-1 1H5c-.55228 0-1-.4477-1-1V5c0-.55228.44772-1 1-1Z",
  sidebarClose:
    "m7 10 1.99994 1.9999-1.99994 2M12 5v14M5 4h14c.5523 0 1 .44772 1 1v14c0 .5523-.4477 1-1 1H5c-.55228 0-1-.4477-1-1V5c0-.55228.44772-1 1-1Z",
  hamburger: "M5 7h14M5 12h14M5 17h14",
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar({ open, width, onOpenChange }: Props) {
  const currentUser = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();

  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  const linkBase =
    "flex w-full text-sm font-[500] px-2 py-2.5 rounded-lg mb-2 transition-colors text-textColorSecond text-right md:text-left";

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
    <div
      style={{ width }}
      className={`h-full lg:bg-linePrimary ${open ? "w-full" : "w-10"}`}
    >
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
          className="ml-auto cursor-pointer hover:text-textcolor lg:hidden"
        >
          <Icon path={ICONS.hamburger} />
        </button>
      </div>

      <div className={open ? "" : "hidden"}>
        <div className="flex justify-center">
          <Image src="/LogoSVG.svg" alt="Logo" width={200} height={200} />
        </div>

        <div className="px-4">
          <div className="mt-6 flex px-2 py-1 text-logoblue">
            <h1 className="mx-auto">{currentUser?.username ?? "error"}</h1>
          </div>

          <h1 className="text-right lg:text-left mt-6 border-b border-lineSecondary px-2 py-1 text-sm font-semibold text-textColorSecond">
            General
          </h1>

          <Link href="/dashboard" className={linkClass("/dashboard")}>
            <div className="flex items-center flex-row-reverse lg:flex-row gap-2 w-full">
              <Icon path={ICONS.home} />
              Home
            </div>
          </Link>

          <Link
            href="/dashboard/booking"
            className={linkClass("/dashboard/booking")}
          >
            <div className="flex items-center flex-row-reverse lg:flex-row gap-2 w-full">
              <Icon path={ICONS.booking} />
              Booking system
            </div>
          </Link>

          <Link
            href="/dashboard/users"
            className={linkClass("/dashboard/users")}
          >
            <div className="flex items-center flex-row-reverse lg:flex-row gap-2 w-full">
              <Icon path={ICONS.users} />
              User management
            </div>
          </Link>

          <Link href="/" className={linkClass("/") + ` hidden`}>
            <div className="flex items-center flex-row-reverse lg:flex-row gap-2 w-full">
              <Icon path={ICONS.home} />
              Edit website
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setRequestModalOpen(true)}
            className={`${linkBase} mt-20 cursor-pointer text-left hover:bg-linePrimary`}
          >
            <div className="flex items-center flex-row-reverse lg:flex-row gap-2 w-full">
              Request new function
            </div>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className={`${linkBase} mt-2 cursor-pointer text-left hover:bg-linePrimary`}
          >
            <div className="flex items-center flex-row-reverse lg:flex-row gap-2 w-full">
              Log out
            </div>
          </button>
        </div>
      </div>

      <FeatureRequestModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        onSubmit={(payload) => {
          console.log("Feature request submitted", payload);
        }}
      />
    </div>
  );
}
