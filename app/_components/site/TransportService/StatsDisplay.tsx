import type { ReactNode } from "react";

type Locale = "en" | "no";

type StatIcon = "star" | "people" | "wrench";

type StatsDisplayProps = {
  content: {
    stats: {
      icon?: StatIcon;
      value: number;
      decimals?: number;
      suffix?: string;
      label: {
        en: string;
        no: string;
      };
    }[];
  };
  locale: Locale;
};

const ICONS: Record<StatIcon, ReactNode> = {
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
      <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345l2.125-5.111Z" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM14.5 14.75c1.15-.5 2.4-.5 3.5.25 1.4.95 2 2.6 2 5" />
    </svg>
  ),
  wrench: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a4 4 0 0 0-5.4 4.6L3 17.2 6.8 21l6.3-6.3a4 4 0 0 0 4.6-5.4l-2.6 2.6-2.8-.8-.8-2.8 2.6-2.6Z" />
    </svg>
  ),
};

export const StatsDisplay = ({ content, locale }: StatsDisplayProps) => {
  const numberLocale = locale === "no" ? "nb-NO" : "en-US";

  return (
    <section className="w-full py-6">
      <div className="mx-auto flex w-full max-w-200 flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {content.stats.map((stat, i) => (
          <div key={i} className="flex items-center gap-2 text-logoblue">
            {stat.icon ? ICONS[stat.icon] : null}
            <div>
              <p className="text-[22px] font-bold leading-tight">
                {stat.value.toLocaleString(numberLocale, {
                  minimumFractionDigits: stat.decimals ?? 0,
                  maximumFractionDigits: stat.decimals ?? 0,
                })}
                {stat.suffix ?? ""}
              </p>
              <p className="text-[14px] leading-tight text-textcolor">{stat.label[locale]}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
