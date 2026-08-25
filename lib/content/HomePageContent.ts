export type HomePageTestimonial = {
  id: string;
  rating: number;
  text: string;
  author: string;
};

export const homePageContent = {
  title: {
    en: "What can we help you with today?",
    no: "Hva skal vi hjelpe deg med i dag?",
  },
  subtitle: {
    en: "All the way there. All the way in. All taken care of.",
    no: "Helt frem. Helt inn. Helt klart.",
  },
  introHeading: {
    en: "A transport partner that stays with you every step of the way.",
    no: "En transportpartner som følger deg hele veien.",
  },
  introText: {
    en: ` We don’t just deliver to your door. We get the job done.
From pickup to delivery, carrying in and assembly – one booking, one point of contact, and one responsibility. For private customers and businesses, locally and over longer distances across Norway.
All the way there. All the way in. All taken care of.`,
    no: ` Vi leverer ikke bare til døren. Vi gjør jobben ferdig.
Fra henting til levering, innbæring og montering – én bestilling, én kontakt og ett ansvar. For privatkunder og bedrifter, lokalt og over lengre avstander i Norge.
Helt frem. Helt inn. Helt klart`,
  },
  extraHeading: {
    en: `Different jobs require different solutions. OTMAN finds the right one for you.`,
    no: `Ulike oppdrag krever ulike løsninger. OTMAN finner den rette for deg.`,
  },
  aboutLinkText: {
    en: "Read more about us",
    no: "Les mer om oss",
  },
  aboutImageAlt: {
    en: "Otman Transport crew carrying a delivery",
    no: "Otman Transport-team som bærer en leveranse",
  },
  aboutImageSrc: "https://public-otman-img.s3.eu-north-1.amazonaws.com/Home/OtmanAS-Delivery-Assembly-Oslo.jpg",
  testimonialsHeading: {
    en: "What our customers say",
    no: "Det sier kundene våre",
  },
  // Populated at request time from the Google-reviews cache — see
  // getCachedGoogleReviews() in lib/site/googleReviews.ts. Deliberately empty
  // here: there is no static fallback, and the testimonials section is skipped
  // entirely whenever this is empty (cron hasn't run yet, or the DB is down).
  testimonials: [] as HomePageTestimonial[],
  mapTitle: {
    en: "Find us",
    no: "Finn oss",
  },
  gallery: [
    {
      src: "https://public-otman-img.s3.eu-north-1.amazonaws.com/Home/B107A728-ADD0-4470-A944-E145AC8B5154.jpeg",
      alt: {
        en: "Otman AS at work",
        no: "Otman AS i arbeid",
      },
      cropY: "40%",
    },
    {
      src: "https://public-otman-img.s3.eu-north-1.amazonaws.com/Home/501F045B-C997-4CDF-919C-4F8E79102909.jpeg",
      alt: {
        en: "Otman AS at work",
        no: "Otman AS i arbeid",
      },
      cropY: "60%",
    },
    {
      src: "https://public-otman-img.s3.eu-north-1.amazonaws.com/Home/364DAFA5-04FE-4D6C-968D-C78CC61EEE01%281%29.jpg",
      alt: {
        en: "Otman AS at work",
        no: "Otman AS i arbeid",
      },
      cropY: "75%",
    },
  ],
  cta: {
    title: {
      en: "What do you need help with?",
      no: "Hva trenger dere hjelp med?",
    },
    subtitle: {
      en: "Tell us what you need - we'll take care of the rest",
      no: "Fortell oss hva du trenger - vi ordner resten",
    },
    buttonText: {
      en: "Book a service",
      no: "Bestill tjeneste",
    },
  },
  items: [
    {
      title: {
        en: "Collection & Pickup",
        no: "Henting og innsamling",
      },
      svg: "Service logos-01.svg",
    },
    {
      title: {
        en: "Package Delivery",
        no: "Pakkelevering",
      },
      svg: "Service logos-02.svg",
    },
    {
      title: {
        en: "Moving & Relocation",
        no: "Flytting",
      },
      svg: "Service logos-03.svg",
    },
    {
      title: {
        en: "Custom Transport",
        no: "Spesialtransport",
      },
      svg: "Service logos-04.svg",
    },
  ],
  stats: [
    {
      title: {
        en: "Newspapers delivered",
        no: "Aviser levert",
      },
    },
  ],
};
