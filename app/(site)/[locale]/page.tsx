import HomePage from "@/app/_components/site/pageComponents/HomePage";
import { homePageContent } from "@/lib/content/HomePageContent";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <HomePage content={homePageContent} locale={locale} />;
}