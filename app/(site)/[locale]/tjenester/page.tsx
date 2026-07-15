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
  const description =
    locale === "no"
      ? "Se alle tjenester fra Otman AS: transport, flytting, montering, spesialtransport og bemanning for private og bedrifter. Be om et uforpliktende tilbud."
      : "Explore all services from Otman AS: transport, moving, assembly, specialized transport and staffing for individuals and businesses. Request a free quote.";
  return {
    title: TjenesterContent.heroTitle[locale],
    description,
    alternates: buildAlternates(locale, "/tjenester"),
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <Tjenester content={TjenesterContent} locale={locale}/>
}
