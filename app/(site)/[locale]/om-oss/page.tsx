import type { Metadata } from "next";
import About from "@/app/_components/site/pageComponents/AboutPage";
import { AboutContent } from "@/lib/content/AboutContent";
import { buildAlternates } from "@/lib/site/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title =
    locale === "no"
      ? "Om Otman AS – en familiedrevet transportbedrift"
      : "About Otman AS – A Family-Run Transport Company";
  const description =
    locale === "no"
      ? "Otman AS er et familiedrevet transportselskap etablert i 2021. Les om vår historie, våre verdier og teamet bak transport- og flyttetjenestene våre."
      : "Otman AS is a family-run transport company founded in 2021. Read about our history, values and the team behind our transport and moving services.";
  return { title, description, alternates: buildAlternates(locale, "/om-oss") };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <About content={AboutContent} locale={locale}/>
}