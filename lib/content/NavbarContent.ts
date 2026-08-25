export type Locale = "en" | "no";

export type LocalizedText = Record<Locale, string>;

export const navbarContent = {
  links: [
    {
      id: "transport",
      href: "/",
      label: {
        en: "Transport Services",
        no: "Transporttjenester",
      },
    },
    {
      id: "vehicle-rental",
      href: "/bil-utleie",
      label: {
        en: "Vehicle Rental",
        no: "Bilutleie",
      },
    },
    {
      id: "tjenester",
      href: "/tjenester",
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
      id: "blog",
      href: "/blogg",
      label: {
        en: "Blog",
        no: "Blogg",
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
  contactLabel: {
    en: "Contact",
    no: "Kontakt",
  },
  dashboardLabel: {
    en: "Login",
    no: "Login",
  },
  openMenuLabel: {
    en: "Open main menu",
    no: "Åpne hovedmeny",
  },
};
