import type { Metadata } from "next";
import LegalPage from "@/app/_components/site/pageComponents/LegalPage";
import { privacyPolicyContent } from "@/lib/content/LegalContent";
import { buildAlternates } from "@/lib/site/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const description =
    locale === "no"
      ? "Les Otman AS' personvernerklæring for å forstå hvordan vi samler inn, bruker og beskytter dine personopplysninger."
      : "Read Otman AS's privacy policy to understand how we collect, use and protect your personal data.";
  return {
    title: privacyPolicyContent.title[locale],
    description,
    alternates: buildAlternates(locale, "/privacy-policy"),
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <LegalPage content={privacyPolicyContent} locale={locale} />;
}
