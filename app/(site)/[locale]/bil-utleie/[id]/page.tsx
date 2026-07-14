import type { Metadata } from "next";
import CarRentalDetailsPage from "@/app/_components/site/pageComponents/CarRentalDetailsPage";
import { buildAlternates } from "@/lib/site/seo";
import { vehicles } from "@/lib/vehicles";

type Props = {
  params: Promise<{ locale: "en" | "no"; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const vehicle = vehicles.find((v) => v.id === Number(id));
  const title = vehicle
    ? locale === "no"
      ? `${vehicle.name} – bilutleie og kjøp hos Otman`
      : `${vehicle.name} – Vehicle Rental and Sales at Otman`
    : undefined;
  return { title, alternates: buildAlternates(locale, `/bil-utleie/${id}`) };
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;

  return <CarRentalDetailsPage params={resolvedParams} />;
}