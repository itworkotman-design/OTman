export const statsContent = {
  stats: [
    {
      icon: "star" as const,
      value: 4.9,
      decimals: 1,
      suffix: "",
      label: {
        en: "Google",
        no: "Google",
      },
    },
    {
      icon: "people" as const,
      value: 0, // placeholder — real value injected from DB query in page.tsx
      decimals: 0,
      suffix: "+",
      label: {
        en: "Jobs completed",
        no: "Oppdrag utført",
      },
    },
    {
      icon: "wrench" as const,
      value: 0, // placeholder — real value injected from DB query in page.tsx
      decimals: 0,
      suffix: "+",
      label: {
        en: "Assemblies done",
        no: "Monteringer gjort",
      },
    },
  ],
};
