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
      id: "services",
      title: {
        en: "Services",
        no: "Tjenester",
      },
      svg: "/Service logos-02.svg",
      modalTitle: {
        en: "Services",
        no: "Tjenester",
      },
      modalIntro: {
        en: "Assembly, installation, and other services for your home.",
        no: "Montering, installasjon og andre tjenester for hjemmet ditt.",
      },
      formVariant: "transport",
      categories: [
        {
          id: "services",
          title: {
            en: "Services",
            no: "Tjenester",
          },
          description: {
            en: "Assembly and installation of what you already have at home.",
            no: "Montering og installasjon av det du allerede har hjemme.",
          },
        },
      ],
    },
    {
      id: "moving",
      title: {
        en: "Moving",
        no: "Flytting",
      },
      svg: "/Service logos-04.svg",
      modalTitle: {
        en: "Moving",
        no: "Flytting",
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
