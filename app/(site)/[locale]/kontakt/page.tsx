import type { Metadata } from "next";
import ContactPage from "@/app/_components/site/pageComponents/ContactPage";
import { ContactContent } from "@/lib/content/ContactContent";
import { buildAlternates } from "@/lib/site/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title =
    locale === "no"
      ? "Kontakt oss for transport, flytting og bilutleie"
      : "Contact Us for Transport, Moving and Vehicle Rental";
  return { title, alternates: buildAlternates(locale, "/kontakt") };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <ContactPage content={ContactContent} locale={locale}/>
}