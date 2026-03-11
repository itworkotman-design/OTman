import Link from "next/link";
import type { Locale, LocalizedText } from "@/lib/content/FooterContent";

type FooterLink = {
  id: string;
  href: string;
  label: LocalizedText;
};

type FooterProps = {
  locale: Locale;
  content: {
    companySectionTitle: LocalizedText;
    navigationSectionTitle: LocalizedText;
    legalSectionTitle: LocalizedText;
    companyInfo: {
      name: string;
      orgNumber: string;
      address: string;
    };
    navigationLinks: FooterLink[];
    legalLinks: FooterLink[];
    copyright: LocalizedText;
  };
};

export function Footer({ locale, content }: FooterProps) {
  return (
    <footer className="w-full bg-logoblue md:bg-white shadow-[0_-1px_2px_0_rgba(0,0,0,0.1)]">
      <div className="mx-auto w-full max-w-200 px-[20] pt-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          <div className="md:justify-self-center">
            <h3 className="text-md font-bold text-white md:text-logoblue">
              {content.companySectionTitle[locale]}
            </h3>
            <ul className="mt-4 space-y-1 text-sm">
              <li className="text-white! md:text-textcolor!">{content.companyInfo.name}</li>
              <li className="text-white! md:text-textcolor!">{content.companyInfo.orgNumber}</li>
              <li className="text-white! md:text-textcolor!">{content.companyInfo.address}</li>
            </ul>
          </div>

          <div className="md:justify-self-center">
            <h3 className="text-md font-bold text-white md:text-logoblue">
              {content.navigationSectionTitle[locale]}
            </h3>
            <ul className="mt-4 space-y-1 text-sm md:text-textcolor">
              {content.navigationLinks.map((link) => (
                <li key={link.id}>
                  <Link href={link.href} className="hover:underline text-white! md:text-textcolor!">
                    {link.label[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:justify-self-center">
            <h3 className="text-md font-bold text-white md:text-logoblue">
              {content.legalSectionTitle[locale]}
            </h3>
            <ul className="mt-4 space-y-1 text-sm">
              {content.legalLinks.map((link) => (
                <li key={link.id}>
                  <Link href={link.href} className="hover:underline text-white! md:text-textcolor!">
                    {link.label[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 pb-6 text-center text-xs">
          <p className="text-white! md:text-neutral-600!">{content.copyright[locale]}</p>
        </div>
      </div>
    </footer>
  );
}