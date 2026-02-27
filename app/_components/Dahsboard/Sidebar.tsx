"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Props = {
  open: boolean;
  width: number;
  onOpenChange: (v: boolean) => void;
};

export default function Sidebar({ open, width, onOpenChange }: Props) {
  const pathname = usePathname();

  const linkBase =
    "block max-w-[400px] w-full text-sm font-[500] px-2 py-2.5 rounded-lg mb-2 transition-colors text-textColorSecond";

  const isActive = (href: string) => pathname === href;

  return (
    <div style={{ width }} className={`h-full bg-linePrimary ${open? `w-full`: `w-10`}`}>
      <div className="pt-2 flex">
        <button onClick={() => onOpenChange(!open)} className="hover:text-textcolor ml-auto px-2 cursor-pointer">
          <svg className="w-[28] h-[28] " aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8.99994 10 7 11.9999l1.99994 2M12 5v14M5 4h14c.5523 0 1 .44772 1 1v14c0 .5523-.4477 1-1 1H5c-.55228 0-1-.4477-1-1V5c0-.55228.44772-1 1-1Z"/>
          </svg>

        </button>
      </div>
        <div className={open? ``: `hidden`}>
          <div className="flex justify-center">
          <Image src="/Logo.png" alt="Logo" width={200} height={200} />
        </div>

        <div className="px-4">
          <h1 className="py-1 mt-6 px-2 font-semibold text-sm text-textColorSecond border-b border-lineSecondary ">General</h1>
          <Link
            href=""
            className={`${linkBase} ${
              isActive("")
                ? "bg-linePrimary"
                : "bg-transparent hover:bg-linePrimary"
            }`}
          >
            <div className="flex items-center">
              <svg className="w-[24] h-[24] mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="m4 12 8-8 8 8M6 10.5V19a1 1 0 0 0 1 1h3v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h3a1 1 0 0 0 1-1v-8.5"/>
              </svg>

              Home
            </div>
          </Link>
          <Link
            href=""
            className={`${linkBase} ${
              isActive("")
                ? "bg-linePrimary"
                : "bg-transparent hover:bg-linePrimary"
            }`}
          >
            <div className="flex items-center">
              <svg className="w-[24] h-[24] mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 5.365V3m0 2.365a5.338 5.338 0 0 1 5.133 5.368v1.8c0 2.386 1.867 2.982 1.867 4.175 0 .593 0 1.292-.538 1.292H5.538C5 18 5 17.301 5 16.708c0-1.193 1.867-1.789 1.867-4.175v-1.8A5.338 5.338 0 0 1 12 5.365ZM8.733 18c.094.852.306 1.54.944 2.112a3.48 3.48 0 0 0 4.646 0c.638-.572 1.236-1.26 1.33-2.112h-6.92Z"/>
              </svg>
              Notifications
            </div>
            
          </Link>
          

          <Link
            href="/dashboard/booking"
            className={`${linkBase} ${
              isActive("/dashboard/booking")
                ? "bg-linePrimary"
                : "bg-transparent hover:bg-linePrimary"
            }`}
          >
            <div className="flex items-center">
              <svg className="w-[24] h-[24] mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.013 6.175 7.006 9.369l5.007 3.194-5.007 3.193L2 12.545l5.006-3.193L2 6.175l5.006-3.194 5.007 3.194ZM6.981 17.806l5.006-3.193 5.006 3.193L11.987 21l-5.006-3.194Z"/>
                <path d="m12.013 12.545 5.006-3.194-5.006-3.176 4.98-3.194L22 6.175l-5.007 3.194L22 12.562l-5.007 3.194-4.98-3.211Z"/>
              </svg>

              Booking
            </div>
          </Link>

          <Link
            href=""
            className={`${linkBase} ${
              isActive("")
                ? "bg-linePrimary"
                : "bg-transparent hover:bg-linePrimary"
            }`}
          >
            <div className="flex items-center">
              <svg className="w-[24] h-[24] mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13.213 9.787a3.391 3.391 0 0 0-4.795 0l-3.425 3.426a3.39 3.39 0 0 0 4.795 4.794l.321-.304m-.321-4.49a3.39 3.39 0 0 0 4.795 0l3.424-3.426a3.39 3.39 0 0 0-4.794-4.795l-1.028.961"/>
              </svg> 


              Connections
            </div>
          </Link>

          <Link
            href="/dashboard/users"
            className={`${linkBase} ${
              isActive("/dashboard/users")
                ? "bg-linePrimary text-textcolor"
                : "bg-transparent hover:bg-linePrimary"
            }`}
          ><div className="flex items-center">
            <svg className="w-[24] h-[24] mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeWidth="1" d="M16 19h4a1 1 0 0 0 1-1v-1a3 3 0 0 0-3-3h-2m-2.236-4a3 3 0 1 0 0-4M3 18v-1a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Zm8-10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
            User management
          </div>
            
          </Link>

          <Link
            href="/dashboard/booking/editPrices"
            className={`${linkBase} ${
              isActive("/dashboard/booking/editPrices")
                ? "bg-linePrimary"
                : "bg-transparent hover:bg-linePrimary"
            }`}
          >
            <div className="flex items-center">
              <svg className="w-[24] h-[24] mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 20a16.405 16.405 0 0 1-5.092-5.804A16.694 16.694 0 0 1 5 6.666L12 4l7 2.667a16.695 16.695 0 0 1-1.908 7.529A16.406 16.406 0 0 1 12 20Z"/></svg>
              Security
          </div>
          </Link>

        </div>
      </div>
      
    </div>
  );
};
