import CarRentalPage from "@/app/_components/site/pageComponents/CarRentalPage";
import { CarRentalContent } from "@/lib/content/CarRentalContent";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <CarRentalPage content={CarRentalContent} locale={locale}/>
}