import ManpowerRentalPage from "@/app/_components/site/pageComponents/ManpowerRentalPage";
import { ManpowerRentalContent } from "@/lib/content/ManpowerRentalContent";


export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <ManpowerRentalPage content={ManpowerRentalContent} locale={locale}/>
}