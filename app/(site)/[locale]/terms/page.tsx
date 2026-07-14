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
  return {
    title: termsContent.title[locale],
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
