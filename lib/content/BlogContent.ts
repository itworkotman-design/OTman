import type { LocalizedText } from "@/lib/content/NavbarContent";

export type BlogSortDirection = "asc" | "desc";

export type BlogPost = {
  id: string;
  title: LocalizedText;
  excerpt: LocalizedText;
  category: LocalizedText;
  author: string;
  publishedAt: string;
  readTimeMinutes: number;
  imageSrc: string;
};

export const blogPageContent = {
  title: {
    en: "Blog",
    no: "Blogg",
  },
  intro: {
    en: "Read practical updates, delivery guidance, and behind-the-scenes notes from the Otman Transport team. This page is ready for the dashboard blog editor that will be added later.",
    no: "Les praktiske oppdateringer, leveringsråd og korte innblikk fra Otman Transport-teamet. Siden er klar for bloggadministrasjonen som kommer senere.",
  },
  searchLabel: {
    en: "Search blogs",
    no: "Søk i blogg",
  },
  searchPlaceholder: {
    en: "Search by title, category, or topic",
    no: "Søk etter tittel, kategori eller tema",
  },
  sortLabel: {
    en: "Sort by date",
    no: "Sorter etter dato",
  },
  newestFirstLabel: {
    en: "Newest first",
    no: "Nyeste først",
  },
  oldestFirstLabel: {
    en: "Oldest first",
    no: "Eldste først",
  },
  submitLabel: {
    en: "Apply",
    no: "Bruk",
  },
  clearLabel: {
    en: "Clear",
    no: "Nullstill",
  },
  emptyTitle: {
    en: "No blogs found",
    no: "Ingen blogginnlegg funnet",
  },
  emptyText: {
    en: "Try another search term or clear the filters.",
    no: "Prøv et annet søkeord eller nullstill filtrene.",
  },
  readTimeLabel: {
    en: "min read",
    no: "min lesing",
  },
  posts: [
    {
      id: "preparing-for-home-delivery",
      title: {
        en: "How to prepare for a smooth home delivery",
        no: "Slik gjør du hjemmeleveringen enklere",
      },
      excerpt: {
        en: "A short checklist for access, parking, contact details, and product readiness before the driver arrives.",
        no: "En kort sjekkliste for adkomst, parkering, kontaktinfo og klargjøring før sjåføren kommer.",
      },
      category: {
        en: "Delivery tips",
        no: "Leveringstips",
      },
      author: "Otman Transport",
      publishedAt: "2026-04-10",
      readTimeMinutes: 4,
      imageSrc: "/IMG-1.png",
    },
    {
      id: "choosing-vehicle-rental",
      title: {
        en: "Choosing the right vehicle for a rental job",
        no: "Velg riktig bil til leieoppdraget",
      },
      excerpt: {
        en: "When a compact van is enough, when a larger van helps, and what to consider before booking.",
        no: "Når en kompakt varebil er nok, når en større varebil lønner seg, og hva du bør vurdere før booking.",
      },
      category: {
        en: "Vehicle rental",
        no: "Bilutleie",
      },
      author: "Otman Transport",
      publishedAt: "2026-03-22",
      readTimeMinutes: 3,
      imageSrc: "/Vehicle_default_crafter.jpg",
    },
    {
      id: "extra-pickup-planning",
      title: {
        en: "Planning orders with extra pickup stops",
        no: "Planlegging av ordre med ekstra hentestopp",
      },
      excerpt: {
        en: "How extra stops affect communication, route planning, and delivery timing for transport orders.",
        no: "Hvordan ekstra stopp påvirker kommunikasjon, ruteplanlegging og leveringstid for transportordre.",
      },
      category: {
        en: "Operations",
        no: "Drift",
      },
      author: "Otman Transport",
      publishedAt: "2026-02-14",
      readTimeMinutes: 5,
      imageSrc: "/Vehicle_default_caddy.jpg",
    },
    {
      id: "manpower-rental-uses",
      title: {
        en: "Common use cases for manpower rental",
        no: "Vanlige bruksområder for bemanning",
      },
      excerpt: {
        en: "A practical overview of where short-term manpower support helps stores, warehouses, and delivery teams.",
        no: "En praktisk oversikt over hvor kortsiktig bemanning hjelper butikker, lager og leveringsteam.",
      },
      category: {
        en: "Manpower",
        no: "Bemanning",
      },
      author: "Otman Transport",
      publishedAt: "2026-01-18",
      readTimeMinutes: 4,
      imageSrc: "/IMG-1.png",
    },
  ] satisfies BlogPost[],
};
