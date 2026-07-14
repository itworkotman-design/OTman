import type { Metadata } from "next";
import Tjenester from "@/app/_components/site/pageComponents/Tjenester";
import { TjenesterContent } from "@/lib/content/TjenesterContent";
import { buildAlternates } from "@/lib/site/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, "/tjenester") };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <Tjenester content={TjenesterContent} locale={locale}/>
}
