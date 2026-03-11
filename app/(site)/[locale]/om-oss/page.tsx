import About from "@/app/_components/site/pageComponents/AboutPage";
import { AboutContent } from "@/lib/content/AboutContent";


export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <About content={AboutContent} locale={locale}/>
}