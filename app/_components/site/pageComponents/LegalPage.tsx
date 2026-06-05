import type { LegalPageContent, Locale } from "@/lib/content/LegalContent";

type LegalPageProps = {
  content: LegalPageContent;
  locale: Locale;
};

export default function LegalPage({ content, locale }: LegalPageProps) {
  return (
    <article className="mx-auto w-full max-w-4xl py-16 text-textcolor">
      <header className="border-b border-lineSecondary pb-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-logoblue">
          Otman AS
        </p>
        <h1 className="text-4xl font-bold text-logoblue md:text-5xl">
          {content.title[locale]}
        </h1>
        <p className="mt-4 text-sm text-textColorSecond">{content.lastUpdated[locale]}</p>
        <div className="mt-8 space-y-4 text-lg leading-8 text-textColorSecond">
          {content.intro.map((paragraph) => (
            <p key={paragraph[locale]}>{paragraph[locale]}</p>
          ))}
        </div>
      </header>

      <div className="divide-y divide-linePrimary">
        {content.sections.map((section) => (
          <section key={section.title[locale]} className="py-8">
            <h2 className="text-2xl font-semibold text-logoblue">{section.title[locale]}</h2>
            <div className="mt-4 space-y-4 text-base leading-7 text-textcolor">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph[locale]}>{paragraph[locale]}</p>
              ))}
              {section.items ? (
                <ul className="list-disc space-y-2 pl-6">
                  {section.items.map((item) => (
                    <li key={item[locale]}>{item[locale]}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
