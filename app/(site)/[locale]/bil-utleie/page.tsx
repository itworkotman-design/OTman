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
  const title =
    locale === "no"
      ? "Bilutleie og kjøp av varebiler og biler i Norge"
      : "Vehicle Rental and Sales – Cars and Vans in Norway";
  return { title, alternates: buildAlternates(locale, "/bil-utleie") };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <CarRentalPage content={CarRentalContent} locale={locale}/>
}