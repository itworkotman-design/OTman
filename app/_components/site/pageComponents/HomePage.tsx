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
  locale: Locale;
}

export default function HomePage({ content, locale }: HomePageProps) {
  return (
    <>
      <header className="py-16">
        <h1 className="text-logoblue text-[40px] md:text-[48px] font-bold justify-self-center">{content.title[locale]}</h1>
        <h3 className="text-logoblue text-[18px] md:text-[20px] font-bold justify-self-center">{content.subtitle[locale]}</h3>
      </header>
      <ServiceWindow
        title={serviceWindowContent.title}
        items={serviceWindowContent.items}
        locale={locale}
      />
      <section className="py-10">
        <h3 className="text-center text-[20px] font-bold pb-2">{content.introHeading[locale]}</h3>
        <p className="text-center mx-auto w-full max-w-200">{content.introText[locale]}</p>
      </section>
      <StatsDisplay content={statsContent} locale={locale} />
      <PartnersDisplay content={partnersContent} locale={locale} />
    </>
  );
}