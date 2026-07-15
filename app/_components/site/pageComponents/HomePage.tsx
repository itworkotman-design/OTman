import { ServiceWindow } from "../TransportService/ServiceWindow";
import { StatsDisplay } from "../TransportService/StatsDisplay";
import { PartnersDisplay } from "../TransportService/PartnersDisplay";
import { homePageContent } from "@/lib/content/HomePageContent";
import { serviceWindowContent } from "@/lib/content/ServiceWindowContent";
import { statsContent } from "@/lib/content/StatsContent";
import { partnersContent } from "@/lib/content/PartnersContent";

type Locale = "en" | "no";
type HomePageProps = {
  content: typeof homePageContent;
  statsContent?: typeof statsContent;
  locale: Locale;
}

export default function HomePage({ content, statsContent: statsContentProp, locale }: HomePageProps) {
  const resolvedStatsContent = statsContentProp ?? statsContent;
  return (
    <>
      <header className="py-16">
        <h1 className="text-logoblue text-[40px] md:text-[48px] font-bold text-center">{content.title[locale]}</h1>
        <p className="text-logoblue text-[18px] md:text-[20px] font-bold text-center">{content.subtitle[locale]}</p>
      </header>
      <ServiceWindow title={serviceWindowContent.title} items={serviceWindowContent.items} locale={locale} />
      <section className="py-10">
        <h2 className="text-center text-[20px] font-bold pb-2">{content.introHeading[locale]}</h2>
        <p className="text-center mx-auto w-full max-w-200">{content.introText[locale]}</p>
      </section>
      <StatsDisplay content={resolvedStatsContent} locale={locale} />
      <PartnersDisplay content={partnersContent} locale={locale} />
    </>
  );
}