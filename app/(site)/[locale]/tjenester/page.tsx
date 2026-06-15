import Tjenester from "@/app/_components/site/pageComponents/Tjenester";
import { TjenesterContent } from "@/lib/content/TjenesterContent";


export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <Tjenester content={TjenesterContent} locale={locale}/>
}
