import ContactPage from "@/app/_components/site/pageComponents/ContactPage";
import { ContactContent } from "@/lib/content/ContactContent";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  return <ContactPage content={ContactContent} locale={locale}/>
}