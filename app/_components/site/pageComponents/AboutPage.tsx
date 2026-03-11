import { AboutContent } from "@/lib/content/AboutContent"
import { PersonItem } from "@/app/_components/site/PersonItem";
import { PartnersDisplay } from "@/app/_components/site/TransportService/PartnersDisplay";
import { partnersContent } from "@/lib/content/PartnersContent";
import Image from "next/image";

type Locale = "en" | "no";
type PageTypes = {
  content: typeof AboutContent;
  locale: Locale;
}

export default function About({content, locale}:PageTypes) {
  return (
    <div className="">
      <section>
        <div className="absolute left-0 w-full h-[400] [clip-path:polygon(0_0,100%_0,100%_100%,0_85%)]">

            <Image
            src="/IMG-1.png"
            alt="bg-img"
            fill
            className="object-cover object-[center_40%]"
            />

            {/* Overlay */}
            <div className="absolute inset-0 backdrop-blur-xs flex items-center justify-center">
                <h1 className="text-4xl lg:text-6xl text-center text-white font-semibold">
                    {content.heroTitle[locale]}
                </h1>
            </div>

        </div>
        </section>
        <section className="pt-[400]">
            <p className="my-10 text-xl">{content.introText[locale]}</p>
        </section>
        <section>
            <div className=" my-20">
                <h1 className="text-center text-4xl font-semibold text-logoblue mb-8">{content.historyTitle[locale]}</h1>
                <p className="text-xl">{content.historyText[locale]}</p>
            </div>
        </section>
        <section>
            <div className="mx-auto px-6 my-20">
                <h1 className="text-center text-4xl font-semibold text-logoblue mb-8">
                    {content.teamTitle[locale]}
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
                    {content.teamMembers.map((member) => (
                    <PersonItem
                        key={member.id}
                        src={member.src}
                        name={member.name}
                        position={member.position[locale]}
                        email={member.email}
                    />
                    ))}
                </div>
            </div>
        </section>
        <PartnersDisplay content={partnersContent} locale="no" />
    </div>
)
}