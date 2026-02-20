import Image from "next/image";

const partners = [
  { id: 1, title: "Bring", src: "/PartnerBring.png", scale: 1.05, yOffset: 0 },
  { id: 2, title: "Helthjem", src: "/PartnerHelthjem.png", scale: 1.15, yOffset: -3 },
  { id: 3, title: "Hoggestabben", src: "/PartnerHoggestabben.png", scale: 1.4, yOffset: -8 },
  { id: 4, title: "OsloBudservice", src: "/PartnerOsloBudservice.png", scale: 0.8, yOffset: 2 },
];

export const PartnersDisplay = () => {
  return (
    <section className="w-full py-[40px] overflow-hidden">
      <div className="mx-auto max-w-[800px] text-center">
        <h2 className="mb-[20px] text-[20px] font-bold text-logoblue">
          Trusted by businesses across Norway
        </h2>

        {/* marquee */}
        <div className="relative overflow-hidden">
          <div className="flex w-max animate-marquee gap-10 hover:[animation-play-state:paused]">
            {[...partners, ...partners].map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className="relative h-[140px] min-w-[170px] shrink-0
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
