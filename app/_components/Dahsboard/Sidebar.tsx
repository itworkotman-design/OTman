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
import { getModuleAccess, hasAnyVisibleDashboardSection, hasFullAccess } from "@/lib/users/access";
import { getBookingArchiveAccess } from "@/lib/orders/archiveAccess";

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

function Icon({ path, path2, className = "mr-2 h-[24] w-[24] shrink-0" }: { path: string; path2?: string; className?: string }) {
  return (
    <svg
      className={className}
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
  sidebarOpen: "M8.99994 10 7 11.9999l1.99994 2M12 5v14M5 4h14c.5523 0 1 .44772 1 1v14c0 .5523-.4477 1-1 1H5c-.55228 0-1-.4477-1-1V5c0-.55228.44772-1 1-1Z",
  sidebarClose: "m7 10 1.99994 1.9999-1.99994 2M12 5v14M5 4h14c.5523 0 1 .44772 1 1v14c0 .5523-.4477 1-1 1H5c-.55228 0-1-.4477-1-1V5c0-.55228.44772-1 1-1Z",
  hamburger: "M5 7h14M5 12h14M5 17h14",
  hours: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 6v6l4 2",
  browser: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z",
  browserBar: "M4 8h16M7.5 5.5h.01M10.5 5.5h.01",
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

  // Home/DashboardHome is its own controllable module (DASHBOARD) with 5
  // independently-toggleable sub-sections (booking overview, GDPR, etc, see
  // lib/users/dashboardSections.ts) — showing the link when literally none
  // of them are visible for this person would just be a dead end, enforced
  // the same way server-side in app/(User)/dashboard/page.tsx.
  const showHome = !currentUser || hasAnyVisibleDashboardSection(currentUser);
  const showGeneralSection = showHome || showUserManagement;
  const showBookingSection = showBooking || showWebsiteOrders || showScheduler;
  const showOthersSection = showWebsiteEditor || showArchive;

  // Booking's own sub-pages (All orders/Create order/Edit prices/Price
  // lists) used to live behind a separate top navbar (NavbarBooking) on
  // desktop, then nested under a "Booking system" parent button; they now
  // render as top-level buttons under the "Booking app" header instead, for
  // every tier, at every width — see the block below.
  const canCreateBooking = !currentUser || getBookingArchiveAccess(currentUser).canCreate;
  const isBookingFullAccess = !currentUser || hasFullAccess(currentUser.role);
  const showBookingPriceLists = Boolean(
    currentUser && !hasFullAccess(currentUser.role) && (currentUser.priceListIds?.length ?? 0) > 0,
  );

  // pathname.startsWith(href) alone false-matches sibling routes that share a
  // prefix (e.g. "/dashboard/website-orders" starts with "/dashboard/website"),
  // so anything past an exact match must be a "/" boundary, not just any char.
  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);

  const linkBase =
    "flex w-full text-base md:text-sm font-[500] px-2 py-3 md:py-2.5 rounded-lg mb-2 transition-colors text-textColorSecond text-left";

  const linkClass = (href: string) =>
    `${linkBase} ${
      isActive(href)
        ? "bg-linePrimary text-textcolor"
        : "bg-transparent hover:bg-linePrimary"
    }`;

  // Booking's own sub-pages (All orders/Create order/Edit prices/Price
  // lists/Scheduler orders) render as top-level nav buttons under the
  // "Booking app" header, at every width — same gray active treatment as
  // every other sidebar link (e.g. User management), just needs its own
  // helper since "/dashboard/booking" needs an exact match (its sub-routes
  // like /dashboard/booking/create would otherwise match via startsWith).
  const bookingLinkClass = (href: string, exact = false) =>
    `${linkBase} ${
      (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`))
        ? "bg-linePrimary text-textcolor"
        : "bg-transparent hover:bg-linePrimary"
    }`;

  // All the booking links live inside one persistent shell
  // (BookingDashboardShell/AutomaticOrdersShell) that doesn't unmount between
  // them, unlike every other Sidebar link's destination — so navigating
  // between them needs an explicit close, or the mobile drawer just stays
  // open over the newly-navigated page. Every caller mounts two Sidebar
  // instances sharing this component (a desktop rail + a mobile drawer),
  // each with its own open/onOpenChange — on desktop, onOpenChange(false)
  // collapses the rail to its narrow width rather than closing a drawer, so
  // this must only fire for the actual mobile instance. lockBodyScrollWhenOpen
  // is only ever passed true on that instance, so it doubles as the signal.
  const closeMobileDrawer = () => {
    if (lockBodyScrollWhenOpen) onOpenChange(false);
  };

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

          {showGeneralSection && (
            <h1 className="flex items-center gap-2 text-left mt-6 border-b border-lineSecondary px-2 py-1 text-sm font-semibold text-textColorSecond text-weird-landscape padding-weird-landscape">
              <Icon path={ICONS.home} className="h-4 w-4 shrink-0" />
              {bookingText(locale, "General")}
            </h1>
          )}

          {showHome && (
            <Link href="/dashboard" className={linkClass("/dashboard")}>
              {bookingText(locale, "Home")}
            </Link>
          )}

          {showUserManagement && (
            <Link href="/dashboard/users" className={linkClass("/dashboard/users")}>
              {bookingText(locale, "User management")}
            </Link>
          )}

          {showBookingSection && (
            <h1 className="flex items-center gap-2 text-left mt-6 border-b border-lineSecondary px-2 py-1 text-sm font-semibold text-textColorSecond text-weird-landscape padding-weird-landscape">
              <Icon path={ICONS.booking} className="h-4 w-4 shrink-0" />
              {bookingText(locale, "Booking app")}
            </h1>
          )}

          {/* Booking's own pages render directly as top-level nav buttons
              (no more separate "Booking system" parent button/background),
              gated per tier: everyone with Booking access sees "All
              orders"; "Create order" only shows for those who can actually
              create (Owner/Admin/Order creator, not Subcontractor); "Edit
              prices" is Owner/Admin only (this is where the 4 admin buttons
              come from, plus Scheduler orders when enabled); "Price lists"
              is the read-only counterpart shown only to non-full-access
              members with an assigned list. */}
          {showBooking && (
            <>
              <Link href="/dashboard/booking" onClick={closeMobileDrawer} className={bookingLinkClass("/dashboard/booking", true)}>
                All orders
              </Link>
              {canCreateBooking && (
                <Link href="/dashboard/booking/create" onClick={closeMobileDrawer} className={bookingLinkClass("/dashboard/booking/create")}>
                  Create order
                </Link>
              )}
              {isBookingFullAccess && (
                <Link href="/dashboard/booking/editPrices" onClick={closeMobileDrawer} className={bookingLinkClass("/dashboard/booking/editPrices")}>
                  Edit prices
                </Link>
              )}
              {showBookingPriceLists && (
                <Link href="/dashboard/booking/pricelists" onClick={closeMobileDrawer} className={bookingLinkClass("/dashboard/booking/pricelists")}>
                  Price lists
                </Link>
              )}
              {showScheduler && (
                <Link href="/dashboard/scheduler-orders" onClick={closeMobileDrawer} className={bookingLinkClass("/dashboard/scheduler-orders")}>
                  Scheduler orders
                </Link>
              )}
            </>
          )}

          {/* Scheduler access doesn't require booking access — memberships can
              have one without the other, so this can't just live in the
              booking buttons above (that whole block is entirely absent
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
            <Link href="/dashboard/website-orders" onClick={closeMobileDrawer} className={bookingLinkClass("/dashboard/website-orders")}>
              {locale === "nb" ? "Nettsidebestillinger" : "Website orders"}
            </Link>
          )}

          {showOthersSection && (
            <h1 className="text-left mt-6 border-b border-lineSecondary px-2 py-1 text-sm font-semibold text-textColorSecond text-weird-landscape padding-weird-landscape">
              {bookingText(locale, "Others")}
            </h1>
          )}

          {showWebsiteEditor && (
            <Link href="/dashboard/website" className={linkClass("/dashboard/website")}>
              <div className="flex items-center flex-row gap-2 w-full text-weird-landscape">
                <Icon path={ICONS.browser} path2={ICONS.browserBar} />
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

          <LanguageSwitchButton
            currentUser={currentUser}
            className={`${linkBase} mt-6 lg:mt-20 cursor-pointer items-center gap-2 text-left hover:bg-linePrimary text-weird-landscape`}
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
