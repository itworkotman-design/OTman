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
  return { alternates: buildAlternates(locale, "/privacy-policy") };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <LegalPage content={privacyPolicyContent} locale={locale} />;
}
