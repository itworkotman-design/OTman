import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/app/_components/site/Navbar";
import { navbarContent } from "@/lib/content/NavbarContent";
import { Footer } from "@/app/_components/site/Footer";
import { footerContent } from "@/lib/content/FooterContent";

export const metadata: Metadata = {
  title: "Otman Transport",
  description: "Otman Transport",
};

const locales = ["en", "no"] as const;
type Locale = (typeof locales)[number];

export default async function SiteLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar locale={locale as Locale} content={navbarContent} />
      <main className="mx-auto w-full max-w-7xl px-5 flex-1 flex flex-col">
        {children}
      </main>
      <Footer locale={locale as Locale} content={footerContent} />
    </div>
  );
}