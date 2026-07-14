import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Navbar } from "@/app/_components/site/Navbar";
import { navbarContent } from "@/lib/content/NavbarContent";
import { Footer } from "@/app/_components/site/Footer";
import { footerContent } from "@/lib/content/FooterContent";

export const metadata: Metadata = {
  metadataBase: new URL("https://otman.no"),
  title: {
    default: "Otman, flytting og logistikk i Norge",
    template: "%s | Otman AS",
  },
  description:
    "Otman AS leverer transport, henting, pakkelevering, flytting, spesialtransport og bemanning for private og bedrifter i Norge.",
  applicationName: "Otman",
  keywords: [
    "Otman",
    "Otman AS",
    "transport Norge",
    "transport Oslo",
    "budbil",
    "pakkelevering",
    "henting",
    "flytting",
    "spesialtransport",
    "logistikk",
    "bemanning transport",
    "manpower rental Norway",
    "transport services Norway",
  ],
  authors: [{ name: "Otman AS" }],
  creator: "Otman AS",
  publisher: "Otman AS",
  openGraph: {
    type: "website",
    locale: "nb_NO",
    alternateLocale: ["en_US"],
    siteName: "Otman AS",
    url: "https://otman.no",
    title: "Otman AS | Transport, flytting og logistikk i Norge",
    description:
      "Transport, henting, pakkelevering, flytting, spesialtransport og bemanning for private og bedrifter i Norge.",
    images: [
      {
        url: "https://public-otman-img.s3.eu-north-1.amazonaws.com/OGIMAGE.jpg",
        width: 1200,
        height: 630,
        alt: "Otman AS, flytting og logistikk i Norge",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Otman AS | Transport, flytting og logistikk i Norge",
    description:
      "Transport, henting, pakkelevering, flytting, spesialtransport og bemanning for private og bedrifter i Norge.",
    images: ["https://public-otman-img.s3.eu-north-1.amazonaws.com/OGIMAGE.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const locales = ["en", "no"] as const;
type Locale = (typeof locales)[number];

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Otman AS",
  url: "https://otman.no",
  telephone: "+47 402 84 977",
  email: "info@otman.no",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Nittebergsvingen 8",
    postalCode: "2007",
    addressLocality: "Kjeller",
    addressCountry: "NO",
  },
  areaServed: {
    "@type": "Country",
    name: "Norway",
  },
  description:
    "Transport, pakkelevering, flytting, spesialtransport og bemanning for private og bedrifter i Norge.",
  sameAs: ["https://otman.no"],
} as const;

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

  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        nonce={nonce}
        // Browsers clear the nonce attribute from the DOM after use (so injected scripts can't read and reuse it),
        // which makes React see a server/client mismatch on this attribute alone — expected, not a real bug.
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(localBusinessJsonLd),
        }}
      />
      <Navbar locale={locale as Locale} content={navbarContent} />
      <main className="mx-auto w-full max-w-7xl px-5 flex-1 flex flex-col">
        {children}
      </main>
      <Footer locale={locale as Locale} content={footerContent} />
    </div>
  );
}
