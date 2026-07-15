import type { Metadata } from "next";
import CarRentalDetailsPage from "@/app/_components/site/pageComponents/CarRentalDetailsPage";
import { buildAlternates } from "@/lib/site/seo";
import { vehicles } from "@/lib/vehicles";

type Props = {
  params: Promise<{ locale: "en" | "no"; id: string }>;
};

// Meta descriptions have a practical display limit (~155-160 chars), so trim the
// vehicle's full description at a word boundary rather than mid-word.
function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const vehicle = vehicles.find((v) => v.id === Number(id));
  const title = vehicle
    ? locale === "no"
      ? `${vehicle.name} – bilutleie og kjøp hos Otman`
      : `${vehicle.name} – Vehicle Rental and Sales at Otman`
    : undefined;
  const description = vehicle ? truncateAtWord(vehicle.description[locale], 155) : undefined;
  return { title, description, alternates: buildAlternates(locale, `/bil-utleie/${id}`) };
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;

  return <CarRentalDetailsPage params={resolvedParams} />;
}