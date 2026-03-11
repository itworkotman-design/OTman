import Image from "next/image";

type Locale = "en" | "no";

type Partner = {
  id: number;
  title: string;
  src: string;
  scale?: number;
  yOffset?: number;
};

type PartnersDisplayProps = {
  content: {
    title: {
      en: string;
      no: string;
    };
    partners: Partner[];
  };
  locale: Locale;
};

export const PartnersDisplay = ({ content, locale }: PartnersDisplayProps) => {
  const partners = content.partners;

  return (
    <section className="w-full py-[40] overflow-hidden">
      <div className="mx-auto max-w-[800] text-center">
        <h2 className="mb-[20] text-[20px] font-bold text-logoblue">
          {content.title[locale]}
        </h2>

        <div className="relative overflow-hidden">
          <div className="flex w-max animate-marquee gap-10 hover:[animation-play-state:paused]">
            {[...partners, ...partners].map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className="relative h-[140] min-w-[170] shrink-0
                           opacity-70 grayscale transition
                           hover:opacity-100 hover:grayscale-0"
              >
                <Image
                  src={p.src}
                  alt={p.title}
                  fill
                  sizes="170px"
                  className="object-contain"
                  style={{
                    transform: `translateY(${p.yOffset ?? 0}px) scale(${p.scale ?? 1})`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};