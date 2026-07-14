import type { Metadata } from "next";
import CarRentalDetailsPage from "@/app/_components/site/pageComponents/CarRentalDetailsPage";
import { buildAlternates } from "@/lib/site/seo";

type Props = {
  params: Promise<{ locale: "en" | "no"; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  return { alternates: buildAlternates(locale, `/bil-utleie/${id}`) };
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;

  return <CarRentalDetailsPage params={resolvedParams} />;
}