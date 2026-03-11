import CarRentalDetailsPage from "@/app/_components/site/pageComponents/CarRentalDetailsPage";

type Props = {
  params: Promise<{ id: string }>;
};

export default function Page({ params }: Props) {
  return <CarRentalDetailsPage params={params}/>
}