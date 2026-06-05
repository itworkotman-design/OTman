import LegalPage from "@/app/_components/site/pageComponents/LegalPage";
import { termsContent } from "@/lib/content/LegalContent";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <LegalPage content={termsContent} locale={locale} />;
}
