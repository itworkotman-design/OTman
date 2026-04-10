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
      id: "transport-services",
      title: {
        en: "Transport Services",
        no: "Transporttjenester",
      },
      svg: "Service logos-01.svg",
      modalTitle: {
        en: "Transport service planner",
        no: "Planlegg transportoppdrag",
      },
      modalIntro: {
        en: "Choose the transport type, add addresses, and sketch the route requirements.",
        no: "Velg transporttype, legg inn adresser og beskriv oppdraget.",
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
        {
          id: "package-delivery",
          title: {
            en: "Package Delivery",
            no: "Pakklevering",
          },
          description: {
            en: "Fast, local package runs with direct customer delivery.",
            no: "Raske lokale leveranser direkte til kunde.",
          },
        },
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
      id: "manpower-rental",
      title: {
        en: "Manpower Rental",
        no: "Bemanningstjenester",
      },
      svg: "Service logos-02.svg",
      modalTitle: {
        en: "Request manpower",
        no: "Bestill bemanning",
      },
      modalIntro: {
        en: "Select the crew type and describe how many people, how long, and what the team should handle.",
        no: "Velg type bemanning og beskriv antall personer, tidsrom og arbeidsoppgaver.",
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
        {
          id: "carrying-indoor",
          title: {
            en: "Indoor Carrying Help",
            no: "Innbaeringshjelp",
          },
          description: {
            en: "Additional hands for stairs, apartments, and difficult access points.",
            no: "Ekstra hjelp ved trapper, leiligheter og krevende adkomst.",
          },
        },
        {
          id: "assembly-support",
          title: {
            en: "Assembly Support",
            no: "Monteringshjelp",
          },
          description: {
            en: "Practical support around appliance handling and final setup work.",
            no: "Praktisk hjelp rundt hvitevarehandtering og sluttmontering.",
          },
        },
        {
          id: "site-logistics",
          title: {
            en: "Site Logistics Crew",
            no: "Logistikkteam pa stedet",
          },
          description: {
            en: "Flexible manpower for short-term operations and event-style setups.",
            no: "Fleksibel bemanning for korte oppdrag og driftsperioder.",
          },
        },
      ],
    },
    {
      id: "car-rental-services",
      title: {
        en: "Car Rental Services",
        no: "Bilutleietjenester",
      },
      svg: "Service logos-03.svg",
      modalTitle: {
        en: "Reserve a rental vehicle",
        no: "Reserver leiebil",
      },
      modalIntro: {
        en: "Pick the rental category and share when, where, and how long you need the vehicle.",
        no: "Velg leiekategori og oppgi nar, hvor og hvor lenge du trenger bilen.",
      },
      formVariant: "car-rental",
      categories: [
        {
          id: "city-van",
          title: {
            en: "City Van",
            no: "Varebil for bykjoring",
          },
          description: {
            en: "Compact rental for deliveries, small moves, and urban routes.",
            no: "Kompakt leiebil for leveranser, sma flyttelass og byruter.",
          },
        },
        {
          id: "cargo-van",
          title: {
            en: "Cargo Van",
            no: "Stor varebil",
          },
          description: {
            en: "More room for appliances, furniture, and multi-stop transport.",
            no: "Mer plass til hvitevarer, mobler og transport med flere stopp.",
          },
        },
        {
          id: "driver-included",
          title: {
            en: "Vehicle with Driver",
            no: "Kjoretoy med sjafor",
          },
          description: {
            en: "Vehicle access together with a professional operator when needed.",
            no: "Kjoretoy kombinert med profesjonell sjafor ved behov.",
          },
        },
        {
          id: "business-rental",
          title: {
            en: "Business Rental",
            no: "Bedriftsleie",
          },
          description: {
            en: "Longer rental periods for recurring routes and operational support.",
            no: "Lengre leieperioder for faste ruter og operativ drift.",
          },
        },
      ],
    },
    {
      id: "it-services",
      title: {
        en: "IT Services",
        no: "IT Tjenester",
      },
      svg: "Service logos-04.svg",
      modalTitle: {
        en: "Request IT Services",
        no: "Be om IT-tjenester",
      },
      modalIntro: {
        en: "Share what IT services you require and we will contact you!",
        no: "Beskriv hvilke IT-tjenester du trenger, så kontakter vi deg!",
      },
      formVariant: "it-services",
      categories: [
        {
          id: "website-create",
          title: {
            en: "New Website",
            no: "Ny nettside",
          },
          description: {
            en: "Request website creation",
            no: "Be om utvikling av nettside",
          },
        },
      ],
    },
  ] satisfies ServiceGroup[],
};
