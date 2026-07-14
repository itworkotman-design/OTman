// app/_components/Dahsboard/website/WebsiteEditorDashboard.tsx
import Link from "next/link";

type WebsiteEditorCardData = {
  title: string;
  description: string;
  href: string;
  stats: { label: string; value: number }[];
};

type Props = {
  cards: WebsiteEditorCardData[];
};

export default function WebsiteEditorDashboard({ cards }: Props) {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold text-textcolor">Website Editor</h1>
      <p className="mt-2 text-textColorSecond">
        Manage the content shown on the public website.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.href}
            className="flex flex-col rounded-lg border border-linePrimary p-5 shadow-sm"
          >
            <h2 className="text-lg font-bold text-textcolor">{card.title}</h2>
            <p className="mt-2 flex-1 text-sm text-textColorSecond">{card.description}</p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {card.stats.map((stat) => (
                <div key={stat.label} className="rounded-md bg-linePrimary/40 px-3 py-2">
                  <div className="text-lg font-bold text-textcolor">{stat.value}</div>
                  <div className="text-xs text-textColorSecond">{stat.label}</div>
                </div>
              ))}
            </div>

            <Link href={card.href} className="customButtonEnabled mt-4 text-center">
              Manage {card.title.toLowerCase()}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
