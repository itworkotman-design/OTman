import { AboutContent } from "@/lib/content/AboutContent";
import { PersonItem } from "@/app/_components/site/PersonItem";
import { PartnersDisplay } from "@/app/_components/site/TransportService/PartnersDisplay";
import { partnersContent } from "@/lib/content/PartnersContent";
import { ImageCarousel } from "@/app/_components/blog/ImageCarousel";

type Locale = "en" | "no";
type PageTypes = {
  content: typeof AboutContent;
  locale: Locale;
};

export default function About({ content, locale }: PageTypes) {
  return (
    <div className="">
      <section className="mt-10 grid grid-cols-1 gap-6   lg:grid-cols-[3fr_2fr] lg:items-stretch">
        <div className="flex flex-col">
          <h1 className="text-4xl lg:text-6xl font-semibold text-logoblue">{content.heroTitle[locale]}</h1>
          <p className="mt-6 text-xl whitespace-pre-wrap">{content.introText[locale]}</p>
          <div className=" my-8">
            <h2 className="text-2xl lg:text-4xl font-semibold text-logoblue mb-8">{content.whatWeDoTitle[locale]}</h2>
            <p className="text-xl whitespace-pre-wrap">{content.whatWeDoText[locale]}</p>
          </div>
        </div>
        <div className="mt-22">
          <ImageCarousel
            images={content.gallery.map((image) => ({
              src: image.src,
              alt: image.alt[locale],
              cropY: image.cropY,
            }))}
            autoplay
            intervalSeconds={6}
            frameClassName=" rounded-2xl bg-linePrimary/20"
          />
        </div>
      </section>

      <section>
        <div className=" my-8">
          <h2 className="text-2xl lg:text-4xl font-semibold text-logoblue mb-8">{content.historyTitle[locale]}</h2>
          <p className="text-xl whitespace-pre-wrap">{content.historyText[locale]}</p>
        </div>
      </section>

      <section>
        <div className="my-20">
          <h2 className="text-4xl font-semibold text-logoblue mb-8">{content.teamTitle[locale]}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.teamMembers.map((member) => (
              <PersonItem key={member.id} src={member.src} name={member.name} position={member.position[locale]} email={member.email} />
            ))}
          </div>
        </div>
      </section>
      <PartnersDisplay content={partnersContent} locale={locale} />
    </div>
  );
}
