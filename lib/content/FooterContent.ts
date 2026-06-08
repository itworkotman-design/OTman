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
    name: "Otman AS",
    orgNumber: "Org.nr. 926425293",
    address: "Kjeller, Nittebergsvingen 8, 2007",
  },

  navigationLinks: [
    {
      id: "services",
      href: "/",
      label: {
        en: "Services",
        no: "Tjenester",
      },
    },
    {
      id: "about",
      href: "/om-oss",
      label: {
        en: "About",
        no: "Om oss",
      },
    },
    {
      id: "contact",
      href: "/kontakt",
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
        no: "Personvernerklaering",
      },
    },
    {
      id: "terms",
      href: "/terms",
      label: {
        en: "Terms and conditions",
        no: "Vilkaar og betingelser",
      },
    },
  ],

  copyright: {
    en: "Copyright 2023 - 2026 Otman AS. All rights reserved.",
    no: "Copyright 2023 - 2026 Otman AS. Alle rettigheter forbeholdt.",
  },
};
