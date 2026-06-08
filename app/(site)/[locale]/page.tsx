import HomePage from "@/app/_components/site/pageComponents/HomePage";
import { homePageContent } from "@/lib/content/HomePageContent";
import { statsContent } from "@/lib/content/StatsContent";
import { getOrRefreshSiteStats, HISTORICAL_BASELINE } from "@/lib/site/siteStats";

export const revalidate = 86400;

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
