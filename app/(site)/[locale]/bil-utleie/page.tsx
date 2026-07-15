import type { Metadata } from "next";
import CarRentalPage from "@/app/_components/site/pageComponents/CarRentalPage";
import { CarRentalContent } from "@/lib/content/CarRentalContent";
import { buildAlternates } from "@/lib/site/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const description =
    locale === "no"
      ? "Utforsk Otmans utvalg av utleie- og kjøpsbiler i Norge. Filtrer på drivstoff, karosseri, girkasse og pris for å finne kjøretøyet som passer deg."
      : "Browse Otman's fleet of rental and sale vehicles across Norway. Filter by fuel type, vehicle type, gearbox and price to find the right vehicle for you.";
  return { title: CarRentalContent.pageTitle[locale], description, alternates: buildAlternates(locale, "/bil-utleie") };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <CarRentalPage content={CarRentalContent} locale={locale}/>
}