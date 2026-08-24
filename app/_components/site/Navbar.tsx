"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import type { Locale, LocalizedText } from "@/lib/content/NavbarContent";
import LanguageSwitcher from "@/app/_components/site/LanguageSwitcher";

type NavLink = {
  id: string;
  href: string;
  label: LocalizedText;
};

type NavbarProps = {
  locale: Locale;
  content: {
    links: NavLink[];
    contactLabel: LocalizedText;
    dashboardLabel: LocalizedText;
    openMenuLabel: LocalizedText;
  };
};

export const Navbar = ({ locale, content }: NavbarProps) => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="w-full start-0 z-50 shadow-sm bg-logoblue">
      <div className="nav relative max-w-7xl px-[20] mx-auto grid grid-cols-3 items-center h-15 md:flex">
        <button onClick={() => setOpen((prev) => !prev)} aria-expanded={open} aria-controls="navbar-menu" className="justify-self-start md:hidden">
          <span className="sr-only">{content.openMenuLabel[locale]}</span>
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M5 7h14M5 12h14M5 17h14" />
          </svg>
        </button>
        <Link href={`/${locale}`} className="justify-self-center md:justify-self-auto">
          <Image src="/white horizontal.svg" width={116} height={50} alt="Logo" loading="eager" className="h-[34] w-auto" />
        </Link>

        <div className="flex items-center justify-self-end md:grow ml-auto">
          <div
            id="navbar-menu"
            aria-hidden={!open}
            className={`absolute left-0 top-full h-[calc(100dvh-60px)] w-full overflow-y-auto transform transition-transform duration-300 ease-in-out md:static md:h-auto md:w-auto md:translate-x-0 md:transition-none md:overflow-visible mx-auto md:border-t-0 border-t border-logoblue bg-logoblue shadow-sm md:shadow-none ${
              open ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <ul className="flex flex-col gap-0 p-0 items-start md:flex-row md:gap-8 md:pr-4 md:border-b-0 pl-4">
              {content.links.map((link) => {
                const fullHref = `/${locale}${link.href}`;

                return (
                  <li key={link.id}>
                    <Link
                      href={fullHref}
                      onClick={() => setOpen(false)}
                      className={`
                        block px-3 py-6 md:py-0 text-lg md:text-sm
                        transition-colors duration-140 text-white
                        ${isActive(fullHref) ? "font-bold" : ""}
                      `}
                    >
                      {link.label[locale]}
                    </Link>
                  </li>
                );
              })}
              <li className={`block md:hidden px-10 py-4 md:py-0 text-lg md:text-sm transition-colors duration-140 border-t border-logoblue`}>
                <LanguageSwitcher />
              </li>
            </ul>
          </div>
        </div>

        <div className="relative justify-self-end hidden md:flex items-center gap-4">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="text-logoblue flex items-center justify-center gap-4 bg-white w-22.5 h-7.75 rounded-[26px] text-sm transition-colors duration-140"
          >
            {content.dashboardLabel[locale]}
          </Link>
        </div>
      </div>
    </nav>
  );
};
