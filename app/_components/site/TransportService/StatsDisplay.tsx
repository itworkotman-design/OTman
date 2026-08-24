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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="h-10 w-10" aria-hidden="true">
      {/* <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345l2.125-5.111Z" /> */}

      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="h-10 w-10" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <path d="M16 3.128a4 4 0 0 1 0 7.744" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  wrench: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="h-10 w-10" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />
    </svg>
  ),
};

export const StatsDisplay = ({ content, locale }: StatsDisplayProps) => {
  const numberLocale = locale === "no" ? "nb-NO" : "en-US";

  return (
    <section className="w-full md:py-6">
      <div className="mx-auto flex w-full max-w-200 flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {content.stats.map((stat, i) => (
          <div key={i} className="flex items-center gap-3 text-logoblue">
            {stat.icon ? ICONS[stat.icon] : null}
            <div>
              <p className="text-[18px] md:text-[22px] font-semibold leading-tight">
                {stat.value.toLocaleString(numberLocale, {
                  minimumFractionDigits: stat.decimals ?? 0,
                  maximumFractionDigits: stat.decimals ?? 0,
                })}
                {stat.suffix ?? ""}
              </p>
              <p className="text-[12px] md:text-[14px] font-semibold leading-tight text-textColorSecond">{stat.label[locale]}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
