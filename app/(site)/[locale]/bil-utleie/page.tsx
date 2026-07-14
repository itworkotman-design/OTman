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
  return { alternates: buildAlternates(locale, "/bil-utleie") };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <CarRentalPage content={CarRentalContent} locale={locale}/>
}