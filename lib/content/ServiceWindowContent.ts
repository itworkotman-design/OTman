export type Locale = "en" | "no";

export type LocalizedText = {
  en: string;
  no: string;
};

export type ServiceCategory = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
};

export type ServiceGroup = {
  id: string;
  title: LocalizedText;
  svg: string;
  modalTitle: LocalizedText;
  modalIntro: LocalizedText;
  formVariant: "transport" | "manpower" | "car-rental" | "it-services";
  categories: ServiceCategory[];
};

export const serviceWindowContent = {
  title: {
    en: "Book a service",
    no: "Bestill en tjeneste",
  },
  items: [
    {
      id: "collection-pickup",
      title: {
        en: "Delivery",
        no: "Levering",
      },
      svg: "/Service logos-01.svg",
      modalTitle: {
        en: "Collection and Pickup",
        no: "Henting og oppsamling",
      },
      modalIntro: {
        en: "We deliver whatever you need, straight to your door.",
        no: "Vi leverer det du trenger, rett til døren.",
      },
      formVariant: "transport",
      categories: [
        {
          id: "collection-pickup",
          title: {
            en: "Collection and Pickup",
            no: "Henting og oppsamling",
          },
          description: {
            en: "Store pickups, supplier collections, and scheduled handovers.",
            no: "Butikkhenting, leverandorhenting og planlagte overleveringer.",
          },
        },
      ],
    },
    {
      id: "moving-relocation",
      title: {
        en: "Delivery + Assembly",
        no: "Levering + montering",
      },
      svg: "/Service logos-02.svg",
      modalTitle: {
        en: "Moving and Relocation",
        no: "Flytting og relokasjon",
      },
      modalIntro: {
        en: "We deliver, carry in, and assemble it for you.",
        no: "Vi leverer, bærer inn og monterer for deg.",
      },
      formVariant: "transport",
      categories: [
        {
          id: "moving-relocation",
          title: {
            en: "Moving and Relocation",
            no: "Flytting og relokasjon",
          },
          description: {
            en: "Home moves, office relocations, and multi-stop logistics.",
            no: "Flytting av hjem, kontor og flerstopp logistikk.",
          },
        },
      ],
    },
    {
      id: "custom-transport",
      title: {
        en: "Assembly",
        no: "Montering",
      },
      svg: "/Service logos-03.svg",
      modalTitle: {
        en: "Custom Transport",
        no: "Spesialtransport",
      },
      modalIntro: {
        en: "We assemble what you already have at home.",
        no: "Vi monterer det du allerede har hjemme.",
      },
      formVariant: "transport",
      categories: [
        {
          id: "custom-transport",
          title: {
            en: "Custom Transport",
            no: "Spesialtransport",
          },
          description: {
            en: "Tailored transport for oversized, fragile, or unusual cargo.",
            no: "Skreddersydd transport for stort, skjort eller krevende gods.",
          },
        },
      ],
    },
    {
      id: "all-services",
      title: {
        en: "Moving",
        no: "Flytting",
      },
      svg: "/Service logos-04.svg",
      modalTitle: {
        en: "All Services",
        no: "Alle tjenester",
      },
      modalIntro: {
        en: "We help you with all or part of your move.",
        no: "Vi hjelper deg med hele eller deler av flyttingen.",
      },
      formVariant: "manpower",
      categories: [
        {
          id: "loading-unloading",
          title: {
            en: "Loading and Unloading",
            no: "Lasting og lossing",
          },
          description: {
            en: "Crew support for heavy goods, staging, and structured loading.",
            no: "Mannskap til tunge varer, klargjoring og effektiv lasting.",
          },
        },
      ],
    },
  ] satisfies ServiceGroup[],
};
