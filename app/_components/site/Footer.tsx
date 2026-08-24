import Link from "next/link";
import type { Locale, LocalizedText } from "@/lib/content/FooterContent";
import Image from "next/image";

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
  const localizeHref = (href: string) => {
    if (href.startsWith("http")) return href;
    return `/${locale}${href}`;
  };

  return (
    <footer className="w-full bg-logoblue">
      <div className="mx-auto w-full max-w-7xl px-[20] pt-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-4">
          <div className="md:justify-self-center max-w-[200]">
            <Link href={`/${locale}`} className="justify-self-start">
              <Image src="/white horizontal.svg" width={116} height={50} alt="Logo" loading="eager" className="h-[34] w-auto" />
            </Link>
            <p className="text-white py-2 text-sm">Smart transport og monering. Enkelt bestilt.</p>
            <div className="flex gap-4">
              <Link
                href="https://www.facebook.com/people/Otman-Norge/61589708937702/?mibextid=wwXIfr&rdid=c3IeGfeqOTxnXp4L&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F1FqF3LhnEQ%2F%3Fmibextid%3DwwXIfr"
                className=""
              >
                <Image src="/facebook.svg" width={50} height={50} alt="Logo" loading="eager" className="h-[26] w-[26] filter-[brightness(0)_invert(1)]" />
              </Link>
              <Link href="https://www.instagram.com/otmannorge?igsi=MXBwc2tkNjR3ZTYydg%3D%3D&" className="">
                <Image src="/instagram.svg" width={50} height={50} alt="Logo" loading="eager" className="h-[26] w-[26] filter-[brightness(0)_invert(1)]" />
              </Link>
              <Link href="https://www.tiktok.com/@otmannorge?_r=1&_t=ZN-999Hy6SJtDi" className="">
                <Image src="/tiktok.svg" width={50} height={50} alt="Logo" loading="eager" className="h-[26] w-[26] filter-[brightness(0)_invert(1)]" />
              </Link>
            </div>
          </div>

          <div className="md:justify-self-center">
            <h3 className="text-md font-bold text-white">{content.companySectionTitle[locale]}</h3>
            <ul className="mt-4 space-y-1 text-sm">
              <li className="text-white">{content.companyInfo.name}</li>
              <li className="text-white">{content.companyInfo.orgNumber}</li>
              <li className="text-white">{content.companyInfo.address}</li>
            </ul>
          </div>

          <div className="md:justify-self-center">
            <h3 className="text-md font-bold text-white">{content.navigationSectionTitle[locale]}</h3>
            <ul className="mt-4 space-y-1 text-sm md:text-textcolor">
              {content.navigationLinks.map((link) => (
                <li key={link.id}>
                  <Link href={localizeHref(link.href)} className="hover:underline text-white">
                    {link.label[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:justify-self-center">
            <h3 className="text-md font-bold text-white">{content.legalSectionTitle[locale]}</h3>
            <ul className="mt-4 space-y-1 text-sm">
              {content.legalLinks.map((link) => (
                <li key={link.id}>
                  <Link href={localizeHref(link.href)} className="hover:underline text-white">
                    {link.label[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 pb-6 text-center text-xs">
          <p className="text-white">{content.copyright[locale]}</p>
        </div>
      </div>
    </footer>
  );
}
