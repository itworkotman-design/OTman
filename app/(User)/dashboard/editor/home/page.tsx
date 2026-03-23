import HomePage from "@/app/_components/site/pageComponents/HomePage";
import { homePageContent } from "@/lib/content/HomePageContent";

export default async function Page() {
  return (
    <HomePage content={homePageContent} locale="en" />
  );
}