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
  const description =
    locale === "no"
      ? "Ta kontakt med Otman AS for transport, flytting, pakkelevering eller bilutleie. Ring, send e-post eller fyll ut skjemaet, så svarer vi deg raskt."
      : "Contact Otman AS for transport, moving, package delivery or vehicle rental. Call, email or fill out the form and we'll get back to you quickly.";
  return { title, description, alternates: buildAlternates(locale, "/kontakt") };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <ContactPage content={ContactContent} locale={locale}/>
}