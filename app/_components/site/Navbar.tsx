"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import type { Locale, LocalizedText } from "@/lib/content/NavbarContent";

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
    <nav className="w-full start-0 z-50 shadow-sm">
      <div className="nav relative max-w-7xl px-[20] mx-auto flex items-center h-15">
        <Link href="/" className="justify-self-start">
          <Image
            src="/LogoSVG.svg"
            width={116}
            height={50}
            alt="Logo"
            className="h-[50] w-auto"
          />
        </Link>

        <div className="flex items-center md:grow ml-auto">
          <button
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls="navbar-menu"
            className="md:hidden"
          >
            <span className="sr-only">{content.openMenuLabel[locale]}</span>
            <svg className="w-8 h-8" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                d="M5 7h14M5 12h14M5 17h14"
              />
            </svg>
          </button>

          <div
            id="navbar-menu"
            className={`${
              open ? "block" : "hidden"
            } absolute right-0 top-full md:mt-0 md:static md:block md:w-auto w-full mx-auto md:border-t-0 border-t border-logoblue bg-white shadow-sm md:shadow-none`}
          >
            <ul className="flex flex-col gap-0 p-0 items-end md:flex-row md:gap-8 md:pr-4 md:border-b-0 pr-4">
              {content.links.map((link) => (
                <li key={link.id}>
                  <Link
                    href={link.href}
                    className={`
                      block px-3 py-6 md:py-0 text-lg md:text-sm
                      transition-colors duration-140
                      ${isActive(link.href) ? "text-logoblue font-bold" : ""}
                    `}
                  >
                    {link.label[locale]}
                  </Link>
                </li>
              ))}

              <li>
                <Link
                  href="/dashboard/booking"
                  className="block px-3 py-6 md:py-0 text-lg md:text-sm transition-colors duration-140 text-pink-600"
                >
                  {content.dashboardLabel[locale]}
                </Link>
              </li>

              <li className="block md:hidden">
                <Link
                  href="/kontakt"
                  className={`
                    block px-3 py-6 md:py-0 text-lg md:text-sm
                    transition-colors duration-140
                    ${isActive("/kontakt") ? "text-logoblue font-bold" : ""}
                  `}
                >
                  {content.contactLabel[locale]}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="relative justify-self-end hidden md:block md:justify-self-end items-center gap-4">
          <Link
            href="/kontakt"
            className="text-white! font-bold flex items-center justify-center gap-4 bg-logoblue w-22.5 h-7.75 rounded-[26px] text-sm transition-colors duration-140"
          >
            {content.contactLabel[locale]}
          </Link>
        </div>
      </div>
    </nav>
  );
};