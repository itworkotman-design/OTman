import { ManpowerRentalContent } from "@/lib/content/ManpowerRentalContent";

type Locale = "en" | "no";

type PageProps = {
  content: typeof ManpowerRentalContent;
  locale: Locale;
};

export default function ManpowerRentalPage({content, locale}: PageProps) {



  return (
    <div className="my-8">
      <section className="mb-10">
        <div className="overflow-hidden ">
          <div className="grid gap-10 md:grid-cols-2">
            <div className="flex flex-col justify-center">
              <h1 className="text-2xl lg:text-5xl font-semibold text-logoblue">{content.heroTitle[locale]}</h1>
              <p className="mt-5 text-black/50">{content.heroText[locale]}</p>
            </div>

            <div className="relative min-h-[320] overflow-hidden">
              <div className="relative flex h-full flex-col justify-between">
                <div className="grid grid-cols-2 gap-4">
                  {content.featureCards.map((card, index) => (
                    <div key={index} className={card.highlighted ? "rounded-3xl bg-logoblue p-5 text-white shadow-sm" : "rounded-3xl p-5 shadow-sm"}>
                      <div className={card.highlighted ? "text-sm text-white" : "text-sm text-black/50"}>
                        {card.label[locale]}
                      </div>
                      <div className={card.highlighted ? "mt-2 text-lg font-semibold" : "mt-2 text-lg font-semibold text-textcolor"}>
                        {card.title[locale]}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {content.benefits[locale].map((item) => (
                      <div key={item} className="flex items-start gap-3 text-sm text-black/50">
                        <span className="mt-0.5 inline-block h-2.5 w-2.5 rounded-full bg-lineSecondary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto">
        <div className="lg:grid grid-cols-2 gap-20">
          <div className="rounded-3xl mb-10 lg:mb-0 bg-logoblue py-4 px-8 text-white">
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">{content.processTitle[locale]}</h2>
            <div className="mt-8 space-y-5">
              {content.steps.map(step => (
                <div key={step.number} className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/10">
                  <div className="text-sm font-semibold text-white/60 flex gap-10">
                    <p>{step.number}</p>
                    <h3 className="mt-1 text-lg font-semibold">{step.title[locale]}</h3>
                  </div>
                  
                  <p className="mt-2 text-sm leading-6 text-white/80">{step.text[locale]}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="customContainer mb-10 lg:mb-0 py-4! px-8! rounded-3xl! flex flex-col">
            <div className="">
                <h2 className="mt-3 text-3xl font-semibold text-logoblue">{content.formTitle[locale]}</h2>
                <p className="mt-4 text-base leading-7 text-slate-600">{content.formText[locale]}</p>
            </div>
            <form className="mt-8 space-y-6 flex-col">
                    <input className="rounded-2xl w-full custom bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50" placeholder={content.formPlaceholders.name[locale]}/>
                    <input className="rounded-2xl w-full bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50" placeholder={content.formPlaceholders.contact[locale]}/>
                    <input className="rounded-2xl w-full bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50" placeholder={content.formPlaceholders.jobType[locale]}/>
                    <textarea className="min-h-[120] w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50" placeholder={content.formPlaceholders.description[locale]}/>
            </form>
            <div className="mt-auto">
                <button className="customButtonEnabled w-full h-12">{content.submitButton[locale]}</button>
            </div>
            
          </div>
        </div>
      </section>
    </div>
  );
}
