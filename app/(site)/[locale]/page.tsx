import HomePage from "@/app/_components/site/pageComponents/HomePage";
import { homePageContent } from "@/lib/content/HomePageContent";
import { statsContent } from "@/lib/content/StatsContent";
import { getOrRefreshSiteStats } from "@/lib/site/siteStats";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}) {
  const { locale } = await params;

  //const siteStats = await getOrRefreshSiteStats();

  // const dynamicStatsContent = {
  //   stats: [
  //     { value: siteStats.productsInstalled, label: statsContent.stats[0].label },
  //     { value: siteStats.kmDriven, label: statsContent.stats[1].label },
  //     { value: siteStats.ordersCompleted, label: statsContent.stats[2].label },
  //   ],
  // };

  return <HomePage content={homePageContent} locale={locale} />;
}
