"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import FeatureRequestModal from "@/app/_components/Dahsboard/FeatureRequestModal";
import { bookingText } from "@/lib/booking/bookingUiText";
import { useUserLanguage } from "@/lib/users/language";
import LanguageSwitchButton from "@/app/_components/Users/LanguageSwitchButton";
import { getUserLogoDisplayPath } from "@/lib/users/profileAppearance";
import { getModuleAccess } from "@/lib/users/access";

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
  sidebarOpen: "M8.99994 10 7 11.9999l1.99994 2M12 5v14M5 4h14c.5523 0 1 .44772 1 1v14c0 .5523-.4477 1-1 1H5c-.55228 0-1-.4477-1-1V5c0-.55228.44772-1 1-1Z",
  sidebarClose: "m7 10 1.99994 1.9999-1.99994 2M12 5v14M5 4h14c.5523 0 1 .44772 1 1v14c0 .5523-.4477 1-1 1H5c-.55228 0-1-.4477-1-1V5c0-.55228.44772-1 1-1Z",
  hamburger: "M5 7h14M5 12h14M5 17h14",
  hours: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 6v6l4 2",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5 0 4-4 4-9s-1.5-9-4-9-4 4-4 9 1.5 9 4 9ZM3 12h18",
  folderOpen:
    "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar({ open, width, onOpenChange, lockBodyScrollWhenOpen }: Props) {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
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
  const currentUserLogoPath = currentUser?.logoPath ?? null;
  const currentUserLogoDisplayPath = getUserLogoDisplayPath(currentUserLogoPath);
  const usernameStyle = currentUser?.usernameDisplayColor
    ? { color: currentUser.usernameDisplayColor }
    : undefined;

  // Fail open while currentUser is still loading (matches the pattern used
  // by the dashboard pages themselves) — the destination page/API still
  // enforces the real check, this only avoids a flash of a link disappearing
  // right after it renders.
  const showBooking = !currentUser || getModuleAccess(currentUser, "BOOKING").enabled;
  const showWebsiteOrders = !currentUser || getModuleAccess(currentUser, "WEBSITE_ORDERS").enabled;
  const showUserManagement = !currentUser || getModuleAccess(currentUser, "USER_MANAGEMENT").enabled;
  const showWebsiteEditor = !currentUser || getModuleAccess(currentUser, "WEBSITE_EDITOR").enabled;
  const showArchive = !currentUser || getModuleAccess(currentUser, "ARCHIVE").enabled;
  // Matches NavbarBooking's own gating for this link — no fail-open, since
  // it's a rarer sub-feature and NavbarBooking never showed it while
  // currentUser was still loading either.
  const showScheduler = Boolean(currentUser && getModuleAccess(currentUser, "SCHEDULER").enabled);

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  const linkBase =
    "flex w-full text-base md:text-sm font-[500] px-2 py-3 md:py-2.5 rounded-lg mb-2 transition-colors text-textColorSecond text-left";

  const linkClass = (href: string) =>
    `${linkBase} ${
      isActive(href)
        ? "bg-linePrimary text-textcolor"
        : "bg-transparent hover:bg-linePrimary"
    }`;

  // Booking's own sub-pages — mobile only (see the "Booking system" link
  // below). On desktop these still live in NavbarBooking's separate top nav
  // bar; on mobile that second bar is gone and these are nested here instead,
  // inside the same gray group box as their parent — the active one gets a
  // white pill so it stands out against that gray backdrop.
  const bookingSubLinkClass = (href: string, exact = false) =>
    `block w-full rounded-lg px-3 py-2.5 text-base transition-colors ${
      (exact ? pathname === href : pathname.startsWith(href))
        ? "bg-white text-textcolor font-medium shadow-sm"
        : "text-textColorSecond hover:bg-white/60"
    }`;

  // All the booking links (parent + nested sub-pages) live inside one
  // persistent shell (BookingDashboardShell/AutomaticOrdersShell) that
  // doesn't unmount between them, unlike every other Sidebar link's
  // destination — so navigating between them needs an explicit close, or the
  // mobile drawer just stays open over the newly-navigated page.
  const closeMobileDrawer = () => onOpenChange(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div
      style={{ width }}
      className={`w-full bg-white max-h-dvh overflow-y-auto overscroll-contain lg:h-full lg:max-h-none lg:min-h-0 lg:overflow-visible lg:overscroll-auto lg:bg-linePrimary ${open ? "min-h-dvh" : "lg:w-10"}`}
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
        <button onClick={() => onOpenChange(!open)} className="ml-auto hidden cursor-pointer px-2 hover:text-textcolor lg:block">
          <Icon path={open ? ICONS.sidebarOpen : ICONS.sidebarClose} />
        </button>

        {/* Mobile toggle */}
        <button onClick={() => onOpenChange(!open)} className="ml-auto cursor-pointer hover:text-textcolor lg:hidden">
          <Icon path={ICONS.hamburger} />
        </button>
      </div>

      <div className={`${open ? "" : "hidden"} pb-10 lg:pb-0`}>
        <div className="hidden justify-center lg:flex">
          <Image src="/LogoSVG.svg" alt="Logo" width={116} height={50} className="h-auto w-full max-w-[200]" />
        </div>

        <div className="px-4 padding-weird-landscape">
          <div className="mt-6 flex  border-lineSecondary px-2 py-1 pb-4 padding-weird-landscape">
            <div className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-2 text-center">
              {currentUserLogoDisplayPath ? (
                <img src={currentUserLogoDisplayPath} alt={`${currentUser?.username || currentUser?.email} logo`} className="h-8 w-8 shrink-0 object-contain" />
              ) : null}
              <h1 className="wrap-break-word font-medium text-logoblue text-weird-landscape" style={usernameStyle}>
                {currentUser?.username ?? currentUser?.email ?? "error"}
              </h1>
            </div>
          </div>

          <h1 className="text-left mt-6 border-b border-lineSecondary px-2 py-1 text-sm font-semibold text-textColorSecond text-weird-landscape padding-weird-landscape">
            {bookingText(locale, "General")}
          </h1>

          <Link href="/dashboard" className={linkClass("/dashboard")}>
            <div className="flex items-center flex-row gap-2 w-full text-weird-landscape">
              <Icon path={ICONS.home} />
              {bookingText(locale, "Home")}
            </div>
          </Link>

          {showBooking && (
            <div className={`mb-2 rounded-lg transition-colors ${isActive("/dashboard/booking") ? "bg-linePrimary" : ""}`}>
              <Link
                href="/dashboard/booking"
                onClick={closeMobileDrawer}
                className={`flex w-full text-base md:text-sm font-[500] px-2 py-3 md:py-2.5 rounded-lg transition-colors text-left ${
                  isActive("/dashboard/booking") ? "text-textcolor" : "text-textColorSecond hover:bg-linePrimary"
                }`}
              >
                <div className="flex items-center flex-row gap-2 w-full text-weird-landscape">
                  <Icon path={ICONS.booking} />
                  {bookingText(locale, "Booking system")}
                </div>
              </Link>

              {/* Booking's own pages — mobile only, nested here (inside the
                  same gray group box as their parent) since the mobile layout
                  has no separate NavbarBooking top bar to hold them. */}
              <div className="flex flex-col gap-1 px-2 pb-2 lg:hidden">
                <Link href="/dashboard/booking" onClick={closeMobileDrawer} className={bookingSubLinkClass("/dashboard/booking", true)}>
                  All orders
                </Link>
                <Link href="/dashboard/booking/create" onClick={closeMobileDrawer} className={bookingSubLinkClass("/dashboard/booking/create")}>
                  Create order
                </Link>
                <Link href="/dashboard/booking/editPrices" onClick={closeMobileDrawer} className={bookingSubLinkClass("/dashboard/booking/editPrices")}>
                  Edit prices
                </Link>
                {showScheduler && (
                  <Link href="/dashboard/scheduler-orders" onClick={closeMobileDrawer} className={bookingSubLinkClass("/dashboard/scheduler-orders")}>
                    Scheduler orders
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Scheduler access doesn't require booking access — memberships can
              have one without the other, so this can't just live nested under
              "Booking system" above (that link/section is entirely absent
              when showBooking is false). Mobile only, same reason as above. */}
          {!showBooking && showScheduler && (
            <Link href="/dashboard/scheduler-orders" onClick={closeMobileDrawer} className={`${linkClass("/dashboard/scheduler-orders")} lg:hidden`}>
              <div className="flex items-center flex-row gap-2 w-full text-weird-landscape">
                <Icon path={ICONS.hours} />
                Scheduler orders
              </div>
            </Link>
          )}

          {showWebsiteOrders && (
            <Link href="/dashboard/website-orders" className={linkClass("/dashboard/website-orders")}>
              <div className="flex items-center flex-row gap-2 w-full text-weird-landscape">
                <Icon path={ICONS.globe} />
                {locale === "nb" ? "Nettsidebestillinger" : "Website orders"}
              </div>
            </Link>
          )}

          {showUserManagement && (
            <Link href="/dashboard/users" className={linkClass("/dashboard/users")}>
              <div className="flex items-center flex-row gap-2 w-full text-weird-landscape">
                <Icon path={ICONS.users} />
                {bookingText(locale, "User management")}
              </div>
            </Link>
          )}

          {showWebsiteEditor && (
            <Link href="/dashboard/website" className={linkClass("/dashboard/website")}>
              <div className="flex items-center flex-row gap-2 w-full text-weird-landscape">
                <Icon path={ICONS.edit} />
                {bookingText(locale, "Edit website")}
              </div>
            </Link>
          )}

          {showArchive && (
            <Link href="/dashboard/archive" className={linkClass("/dashboard/archive")}>
              <div className="flex items-center flex-row gap-2 w-full text-weird-landscape">
                <Icon path={ICONS.folderOpen} />
                {bookingText(locale, "Archive")}
              </div>
            </Link>
          )}

          <Link
            href="https://beta.cphours.no/"
            className={`${linkBase} bg-transparent hover:bg-linePrimary`}
            target="_blank"
          >
            <div className="flex items-center flex-row gap-2 w-full text-weird-landscape">
              <Icon path={ICONS.hours} />
              {bookingText(locale, "Custom Hours")}
            </div>
          </Link>

          <LanguageSwitchButton
            currentUser={currentUser}
            className={`${linkBase} mt-20 cursor-pointer items-center gap-2 text-left hover:bg-linePrimary text-weird-landscape`}
          />

          <button
            type="button"
            onClick={() => setRequestModalOpen(true)}
            className={`${linkBase} mt-2 cursor-pointer text-left hover:bg-linePrimary text-weird-landscape`}
          >
            <div className="flex items-center flex-row gap-2 w-full">{bookingText(locale, "Request new function / bug fix")}</div>
          </button>

          <button type="button" onClick={handleLogout} className={`${linkBase} mt-2 cursor-pointer text-left hover:bg-linePrimary text-weird-landscape`}>
            <div className="flex items-center flex-row gap-2 w-full">{bookingText(locale, "log out")}</div>
          </button>
        </div>
      </div>

      <FeatureRequestModal open={requestModalOpen} onClose={() => setRequestModalOpen(false)} onSubmit={() => {}} />
    </div>
  );
}
