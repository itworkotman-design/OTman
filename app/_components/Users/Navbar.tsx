"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import FeatureRequestModal from "@/app/_components/Dahsboard/FeatureRequestModal";
import { getBookingArchiveAccess } from "@/lib/orders/archiveAccess";
import { bookingText } from "@/lib/booking/bookingUiText";
import { useUserLanguage } from "@/lib/users/language";
import LanguageSwitchButton from "@/app/_components/Users/LanguageSwitchButton";
import { getUserLogoDisplayPath } from "@/lib/users/profileAppearance";

type Props = {
  open: boolean;
  width: number | string;
  onOpenChange: (v: boolean) => void;
  // Set by callers rendering this as the mobile overlay drawer (not the
  // always-present desktop rail) — freezes background scroll while the
  // drawer is open, since a `position: fixed` overlay doesn't block touch
  // scroll from reaching the page underneath on its own, even once the
  // drawer's own content scrolls internally.
  lockBodyScrollWhenOpen?: boolean;
};

// ─── Icon paths ───────────────────────────────────────────────────────────────
  

const ICONS = {
  booking:
    "M13 7h6l2 4m-8-4v8m0-8V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v9h2m8 0H9m4 0h2m4 0h2v-4m0 0h-5m3.5 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm-10 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
  createOrder: "M12 20a16.405 16.405 0 0 1-5.092-5.804A16.694 16.694 0 0 1 5 6.666L12 4l7 2.667a16.695 16.695 0 0 1-1.908 7.529A16.406 16.406 0 0 1 12 20Z",
  priceList: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
  sidebarOpen: "M8.99994 10 7 11.9999l1.99994 2M12 5v14M5 4h14c.5523 0 1 .44772 1 1v14c0 .5523-.4477 1-1 1H5c-.55228 0-1-.4477-1-1V5c0-.55228.44772-1 1-1Z",
  sidebarClose: "m7 10 1.99994 1.9999-1.99994 2M12 5v14M5 4h14c.5523 0 1 .44772 1 1v14c0 .5523-.4477 1-1 1H5c-.55228 0-1-.4477-1-1V5c0-.55228.44772-1 1-1Z",
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

export default function UserNavbar({ open, width, onOpenChange, lockBodyScrollWhenOpen }: Props) {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const access = getBookingArchiveAccess(currentUser);
  const pathname = usePathname();
  const router = useRouter();

  const [requestModalOpen, setRequestModalOpen] = useState(false);

  useEffect(() => {
    if (!lockBodyScrollWhenOpen || !open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, lockBodyScrollWhenOpen]);
  const usernameStyle = currentUser?.usernameDisplayColor
    ? { color: currentUser.usernameDisplayColor }
    : undefined;
  const currentUserLabel = currentUser?.username ?? currentUser?.email ?? "";
  const currentUserLogoPath = currentUser?.logoPath ?? null;
  const currentUserLogoDisplayPath = getUserLogoDisplayPath(currentUserLogoPath);

  const isActive = (href: string) =>
    href === "/booking" ? pathname === "/booking" : pathname.startsWith(href);

  const linkBase =
    "flex w-full text-base md:text-sm font-[500] px-2 py-3 md:py-2.5 rounded-lg mb-2 transition-colors text-textColorSecond text-left";

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
      className={`w-full bg-white max-h-dvh overflow-y-auto overscroll-contain lg:h-full lg:max-h-none lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:bg-linePrimary ${open ? "min-h-dvh" : "lg:w-10"}`}
    >
      <div className="relative flex h-[60] items-center px-4 lg:h-auto lg:py-4">
        {/* Logo — always visible on mobile, centered in the bar, filling its height, so it isn't hidden while the menu is closed */}
        <Image
          src="/LogoSVG.svg"
          alt="Logo"
          width={96}
          height={40}
          className="absolute left-1/2 h-full w-auto -translate-x-1/2 lg:hidden"
        />

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

      <div className={`${open ? "" : "hidden"} pb-10 lg:pb-0`}>
        <div className="hidden justify-center lg:flex">
          <Image
            src="/LogoSVG.svg"
            alt="Logo"
            width={116}
            height={50}
            className="h-auto w-full max-w-[200px]"
          />
        </div>

        <div className="px-4">
          <div className="mt-6 flex border-b border-lineSecondary px-2 py-1 pb-6">
            <div className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-2 text-center">
              {currentUserLogoDisplayPath ? (
                <img
                  src={currentUserLogoDisplayPath}
                  alt={`${currentUserLabel} logo`}
                  className="h-8 w-8 shrink-0 object-contain"
                />
              ) : null}
              <h1
                className="break-words font-medium text-logoblue"
                style={usernameStyle}
              >
                {currentUserLabel}
              </h1>
            </div>
          </div>

          <Link href="/booking" className={linkClass("/booking")}>
            <div className="flex items-center flex-row gap-2 w-full">
              <Icon path={ICONS.booking} />
              {bookingText(locale, "Orders")}
            </div>
          </Link>

          {access.canCreate && (
            <Link href="/booking/create" className={linkClass("/booking/create")}>
              <div className="flex items-center flex-row gap-2 w-full">
                <Icon path={ICONS.createOrder} />
                {bookingText(locale, "Create Order")}
              </div>
            </Link>
          )}

          {(currentUser?.priceListIds?.length ?? 0) > 0 && (
            <Link href="/booking/pricelists" className={linkClass("/booking/pricelists")}>
              <div className="flex items-center flex-row gap-2 w-full">
                <Icon path={ICONS.priceList} />
                {bookingText(locale, "Price Lists")}
              </div>
            </Link>
          )}

          <LanguageSwitchButton
            currentUser={currentUser}
            className={`${linkBase} mt-6 lg:mt-20 cursor-pointer items-center gap-2 hover:bg-linePrimary`}
          />

          <button
            type="button"
            onClick={() => setRequestModalOpen(true)}
            className={`${linkBase} mt-2 cursor-pointer hover:bg-linePrimary`}
          >
            {bookingText(locale, "Request new function / bug fix")}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className={`${linkBase} mt-2 cursor-pointer hover:bg-linePrimary`}
          >
            {bookingText(locale, "log out")}
          </button>
        </div>
      </div>

      <FeatureRequestModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        onSubmit={() => {}}
      />
    </div>
  );
}
