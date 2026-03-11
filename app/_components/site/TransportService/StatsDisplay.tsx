type Locale = "en" | "no";

type StatsDisplayProps = {
  content: {
    stats: {
      value: number;
      label: {
        en: string;
        no: string;
      };
    }[];
  };
  locale: Locale;
};

export const StatsDisplay = ({ content, locale }: StatsDisplayProps) => {
  return (
    <section className="w-full py-10">
      <div className="grid grid-cols-1 md:grid-cols-3 md:gap-32 max-w-200 justify-self-center">
        {content.stats.map((stat, i) => (
          <div key={i} className="text-center">
            <h1 className="text-[40px] text-logoblue font-bold">
              {stat.value.toLocaleString()}
            </h1>
            <p>{stat.label[locale]}</p>
          </div>
        ))}
      </div>
    </section>
  );
};