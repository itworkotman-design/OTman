import CarRentalDetailsPage from "@/app/_components/site/pageComponents/CarRentalDetailsPage";

type Props = {
  params: Promise<{ locale: "en" | "no"; id: string }>;
};

export default async function Page({ params }: Props) {
  const resolvedParams = await params;

  return <CarRentalDetailsPage params={resolvedParams} />;
}