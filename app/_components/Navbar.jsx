"use client"
import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"
import Image from "next/image"

export const Navbar = () => {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Helper to check if link is active/current page
  const isActive = (path) => pathname === path

  return (
    <>
      <nav className="w-full start-0 z-50 shadow-sm">
        <div className="nav relative max-w-screen-xl px-[20] mx-auto grid grid-cols-2 md:grid-cols-3 items-center h-[60px] ">
          {/* Grid left - logo */}
          <Link href="/" className="justify-self-start">
            <span className="text-sm text-heading font-semibold"><Image src="/Logo.png" width={116} height={50} alt="Logo"></Image></span>
          </Link>

          {/* Grid middle */}
          <div className="relative justify-self-end md:justify-self-center flex items-center gap-4 md:w-[600px]">
            <button
              onClick={() => setOpen((prev) => !prev)}
              aria-expanded={open}
              aria-controls="navbar-menu"
              className="md:hidden"
            >
              <span className="sr-only">Open main menu</span>
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                  d="M5 7h14M5 12h14M5 17h14"
                />
              </svg>
            </button>

            {/* Collapse menu */}
            <div
              id="navbar-menu"
              className={`${open ? "block" : "hidden"} 
                absolute right-[-20px] top-full w-screen mt-3 
                md:mt-0 md:static md:block md:w-auto  
                md:border-t-0 border-t-1 border-logoblue bg-white shadow-sm md:shadow-none`}
            >
              <ul className="flex flex-col gap-0 p-0 items-end md:flex-row md:gap-8 md:pr-4 md:border-b-0 pr-4 md:pr-0">
                <li>
                  <Link
                    href="/"
                    className={`
                      block px-3 py-6 md:py-0 text-lg md:text-sm
                      transition-colors duration-140
                      ${isActive("/")
                        ? "text-logoblue font-semibold"
                        : "hover:text-green"}
                    `}
                  >
                    Transport Services
                  </Link>
                </li>

                <li>
                  <Link
                    href="/"
                    className={`
                      block px-3 py-6 md:py-0 text-lg md:text-sm
                      transition-colors duration-140
                      ${isActive("/VehicleRental")
                        ? "text-logoblue font-semibold"
                        : "hover:text-green"}
                    `}
                  >
                    Vehicle Rental
                  </Link>
                </li>

                <li>
                  <Link
                    href="/"
                    className={`
                      block px-3 py-6 md:py-0 text-lg md:text-sm
                      transition-colors duration-140
                      ${isActive("/ManpoweRental")
                        ? "text-logoblue font-semibold"
                        : "hover:text-green"}
                    `}
                  >
                    Manpower Rental
                  </Link>
                </li>
                <li>
                  <Link
                    href="/"
                    className={`
                      block px-3 py-6 md:py-0 text-lg md:text-sm
                      transition-colors duration-140
                      ${isActive("/About")
                        ? "text-logoblue font-semibold"
                        : "hover:text-green"}
                    `}
                  >
                    About
                  </Link>
                </li>
                <li className="block md:hidden">
                  <Link
                    href="/"
                    className={`
                      block px-3 py-6 md:py-0 text-lg md:text-sm
                      transition-colors duration-140
                      ${isActive("/About")
                        ? "text-logoblue font-semibold"
                        : "hover:text-green"}
                    `}
                  >
                    Contact
                  </Link>
                </li>

              </ul>
            </div>
          </div>
          {/*Grid Right*/}
          <div className="relative justify-self-end hidden md:block  md:justify-self-end flex items-center gap-4">
          <Link
            href="/"
            className={`
                text-white! font-bold
                flex items-center justify-center gap-4
                bg-logoblue w-[90px] h-[31px] rounded-[26px]
                text-sm transition-colors duration-140`}
            >
            Contact
            </Link>
          </div>
        </div>
      </nav>
    </>
  )
}