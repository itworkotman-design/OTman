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
      id: "manpower",
      href: "/manpower",
      label: {
        en: "Manpower Rental",
        no: "Bemanning",
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
  ],
  contactLabel: {
    en: "Contact",
    no: "Kontakt",
  },
  dashboardLabel: {
    en: "Dashboard",
    no: "Dashboard",
  },
  openMenuLabel: {
    en: "Open main menu",
    no: "Åpne hovedmeny",
  },
};