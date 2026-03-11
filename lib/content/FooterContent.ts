export type Locale = "en" | "no";
export type LocalizedText = Record<Locale, string>;

export const footerContent = {
  companySectionTitle: {
    en: "Company information",
    no: "Firmainformasjon",
  },
  navigationSectionTitle: {
    en: "Navigation",
    no: "Navigasjon",
  },
  legalSectionTitle: {
    en: "Legal",
    no: "Juridisk",
  },

  companyInfo: {
    name: "Otman Transport AS",
    orgNumber: "Org.nr. 926425293",
    address: "Kjeller, Nittebergsvingen 8, 2007",
  },

  navigationLinks: [
    {
      id: "services",
      href: "/services",
      label: {
        en: "Services",
        no: "Tjenester",
      },
    },
    {
      id: "about",
      href: "/about",
      label: {
        en: "About",
        no: "Om oss",
      },
    },
    {
      id: "contact",
      href: "/contact",
      label: {
        en: "Contact",
        no: "Kontakt",
      },
    },
  ],

  legalLinks: [
    {
      id: "privacy-policy",
      href: "/privacy-policy",
      label: {
        en: "Privacy policy",
        no: "Personvernerklæring",
      },
    },
    {
      id: "terms",
      href: "/terms",
      label: {
        en: "Terms & Conditions",
        no: "Vilkår og betingelser",
      },
    },
    {
      id: "cookie-policy",
      href: "/cookie-policy",
      label: {
        en: "Cookie Policy",
        no: "Cookie-erklæring",
      },
    },
  ],

  copyright: {
    en: "© 2023 - 2026 Otman Transport AS. All rights reserved.",
    no: "© 2023 - 2026 Otman Transport AS. Alle rettigheter forbeholdt.",
  },
};