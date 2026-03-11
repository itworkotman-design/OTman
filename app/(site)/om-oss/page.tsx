import About from "@/app/_components/site/pageComponents/AboutPage";
import { AboutContent } from "@/lib/content/AboutContent";


export default function Page() {
  return <About content={AboutContent} locale="no"/>
}