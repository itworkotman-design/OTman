import Image from "next/image";
import Link from "next/link";
import { ServiceWindow } from "../TransportService/ServiceWindow";
import { StatsDisplay } from "../TransportService/StatsDisplay";
import { PartnersDisplay } from "../TransportService/PartnersDisplay";
import GoogleMap from "../GoogleMap";
import { ImageCarousel } from "@/app/_components/blog/ImageCarousel";
import { homePageContent } from "@/lib/content/HomePageContent";
import { serviceWindowContent } from "@/lib/content/ServiceWindowContent";
import { statsContent } from "@/lib/content/StatsContent";
import { partnersContent } from "@/lib/content/PartnersContent";

type Locale = "en" | "no";
type HomePageProps = {
  content: typeof homePageContent;
  statsContent?: typeof statsContent;
  locale: Locale;
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <svg
          key={value}
          className={`h-4 w-4 ${value <= rating ? "text-logoblue" : "text-linePrimary"}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345l2.125-5.111Z" />
        </svg>
      ))}
    </div>
  );
}

export default function HomePage({ content, statsContent: statsContentProp, locale }: HomePageProps) {
  const resolvedStatsContent = statsContentProp ?? statsContent;

  return (
    <>
      <div className="relative">
        <Image
          src="/Logo Icon.svg"
          alt=""
          aria-hidden="true"
          width={1280}
          height={1280}
          className="pointer-events-none absolute -right-[900px] -top-[680px] -z-10 hidden w-[1600] max-w-none opacity-[0.22] md:block"
        />
      </div>

      <header className=" pt-6 pb-8 md:pt-12 md:pb-14 items-center justify-center gap-10">
        <h1 className="text-logoblue text-[32px] md:text-[48px] font-bold leading-10 md:leading-14 text-center whitespace-pre-line pb-4">
          {content.title[locale]}
        </h1>
        <p className="text-textColorSecond text-[14px] md:text-[20px] font-regular text-center">{content.subtitle[locale]}</p>
      </header>

      <ServiceWindow title={serviceWindowContent.title} items={serviceWindowContent.items} locale={locale} />
      <section className="py-4 md:py-8">
        <StatsDisplay content={resolvedStatsContent} locale={locale} />
      </section>

      <section className="pb-14">
        <div className="mx-auto flex max-w-[1200] flex-col items-center gap-10 px-5 lg:flex-row">
          <div className="lg:flex-1">
            <h2 className="text-[18px] md:text-[22px]  font-bold text-logoblue md:text-[26px]">{content.introHeading[locale]}</h2>
            <p className="text-[13px] md:text-[16px] mt-4 text-textColorSecond">{content.introText[locale]}</p>
            <Link href={`/${locale}/om-oss`} className="mt-4 text-[13px] md:text-[16px] inline-block font-semibold text-logoblue hover:underline">
              {content.aboutLinkText[locale]} →
            </Link>
          </div>

          <div className="relative h-[280] w-full overflow-hidden rounded-2xl lg:h-[320] lg:flex-1">
            <Image src={content.aboutImageSrc} alt={content.aboutImageAlt[locale]} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
        </div>
      </section>

      {/* Skipped entirely when there are no Google reviews to show — no
          placeholder copy, no empty heading. */}
      {content.testimonials.length > 0 && (
        <section className="md:py-10">
          <div className="mx-auto max-w-[1200] px-5">
            <h2 className="mb-8 text-[18px] md:text-[22px] font-bold text-logoblue">{content.testimonialsHeading[locale]}</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {content.testimonials.map((review) => (
                <div key={review.id} className="rounded-2xl border border-linePrimary bg-white p-5 shadow-sm">
                  <StarRow rating={review.rating} />
                  <p className="mt-3 text-textcolor text-[14px] md:text-[16px]">&ldquo;{review.text}&rdquo;</p>
                  <p className="mt-3 text-textColorSecond text-[14px] md:text-[16px]">{review.author}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className=" py-6 md:py-10 ">
        <div className="mx-auto max-w-[1200] px-5">
          <h2 className="mb-8 text-[18px] md:text-[22px] font-bold text-logoblue">{content.mapTitle[locale]}</h2>
          <div className="h-[400] w-full overflow-hidden rounded-2xl">
            <GoogleMap />
          </div>
        </div>
      </section>

      <section className="pb-6 md:pb-10">
        <div className="mx-auto max-w-[1200] px-5">
          <div className="flex flex-col items-start gap-6 rounded-2xl bg-logoblue p-8 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-[18px] md:text-[22px] font-semibold">{content.cta.title[locale]}</h2>
              <p className="mt-1 text-[14px] md:text-[16px] font-medium text-white/80">{content.cta.subtitle[locale]}</p>
            </div>
            <Link
              href={`/${locale}/tjenester`}
              className="py-2 md:py-4 px-6 md:px-10 rounded-2xl bg-white text-logoblue font-semibold whitespace-nowrap text-[14px] md:text-[16px]"
            >
              {content.cta.buttonText[locale]} →
            </Link>
          </div>
        </div>
      </section>

      <section className="pb-6 md:pb-10">
        <div className="mx-auto max-w-[1200] px-5">
          <ImageCarousel
            images={content.gallery.map((image) => ({
              src: image.src,
              alt: image.alt[locale],
              cropY: image.cropY,
            }))}
            autoplay
            intervalSeconds={3}
            frameClassName="aspect-[16/9] rounded-2xl bg-linePrimary/20"
          />
        </div>
      </section>
    </>
  );
}
