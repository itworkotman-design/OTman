import type { Metadata } from "next";
import { Navbar } from "@/app/_components/site/Navbar";
import { navbarContent } from "@/lib/content/NavbarContent";
import { Footer } from '../_components/site/Footer'

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
      <Navbar locale="no" content={navbarContent} />
      <main className="mx-auto w-full max-w-7xl px-5 flex-1 flex flex-col">
        {children}
      </main>

      <Footer />
    </div>

  );
}
