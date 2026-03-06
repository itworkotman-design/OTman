import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Navbar } from "../_components/site/Navbar"
import { Footer } from '../_components/site/Footer'
import Link from "next/link";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Otman Transport",
  description: "Otman Transport",
};

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Link href="/dashboard/booking"><button className="absolute top-30 left-20 customButtonDefault " >Pagaidu poga uz dashboard</button></Link>
      <main className="mx-auto w-full max-w-7xl px-5 flex-1 flex flex-col">
        {children}
      </main>

      <Footer />
    </div>

  );
}
