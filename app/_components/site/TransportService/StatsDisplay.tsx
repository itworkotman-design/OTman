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
      <div className="grid grid-cols-1 md:grid-cols-3 md:gap-32 max-w-200 mx-auto">
        {content.stats.map((stat, i) => (
          <div key={i} className="text-center">
            <p className="text-[40px] text-logoblue font-bold">
              {stat.value.toLocaleString()}
            </p>
            <p>{stat.label[locale]}</p>
          </div>
        ))}
      </div>
    </section>
  );
};