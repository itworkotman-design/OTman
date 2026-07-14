import type { Metadata } from "next";
import About from "@/app/_components/site/pageComponents/AboutPage";
import { AboutContent } from "@/lib/content/AboutContent";
import { buildAlternates } from "@/lib/site/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, "/om-oss") };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <About content={AboutContent} locale={locale}/>
}