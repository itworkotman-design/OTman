import type { Metadata } from "next";
import LegalPage from "@/app/_components/site/pageComponents/LegalPage";
import { termsContent } from "@/lib/content/LegalContent";
import { buildAlternates } from "@/lib/site/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const description =
    locale === "no"
      ? "Les Otman AS' vilkår og betingelser for bruk av våre tjenester innen transport, flytting og bilutleie."
      : "Read Otman AS's terms and conditions for using our transport, moving and vehicle rental services.";
  return {
    title: termsContent.title[locale],
    description,
    alternates: buildAlternates(locale, "/terms"),
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <LegalPage content={termsContent} locale={locale} />;
}
