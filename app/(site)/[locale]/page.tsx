import type { Metadata } from "next";
import HomePage from "@/app/_components/site/pageComponents/HomePage";
import { homePageContent } from "@/lib/content/HomePageContent";
import { statsContent } from "@/lib/content/StatsContent";
import { getOrRefreshSiteStats, HISTORICAL_BASELINE } from "@/lib/site/siteStats";
import { buildAlternates } from "@/lib/site/seo";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title =
    locale === "no"
      ? "Transport, flytting og bilutleie i hele Norge"
      : "Transport, Moving and Vehicle Rental Across Norway";
  return { title, alternates: buildAlternates(locale) };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  let liveStats = { productsInstalled: 0, kmDriven: 0, ordersCompleted: 0 };
  try {
    liveStats = await getOrRefreshSiteStats();
  } catch {
    // DB unavailable — page still renders using historical baseline only
  }

  const dynamicStatsContent = {
    stats: [
      { value: HISTORICAL_BASELINE.productsInstalled + liveStats.productsInstalled, label: statsContent.stats[0].label },
      { value: HISTORICAL_BASELINE.kmDriven + liveStats.kmDriven,                   label: statsContent.stats[1].label },
      { value: HISTORICAL_BASELINE.ordersCompleted + liveStats.ordersCompleted,     label: statsContent.stats[2].label },
    ],
  };

  return <HomePage content={homePageContent} statsContent={dynamicStatsContent} locale={locale} />;
}
