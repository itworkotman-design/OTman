import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerCustomerSession } from "@/lib/customerAccounts/serverCustomerSession";
import { listCustomerOrders } from "@/lib/customerAccounts/customerOrderView";
import CustomerLogoutButton from "@/app/_components/site/pageComponents/myOrder/CustomerLogoutButton";
import { customerStatusLabel } from "@/app/_components/site/pageComponents/myOrder/customerStatusLabel";

export const metadata: Metadata = {
  title: "Min bestilling | Otman AS",
  robots: { index: false, follow: false },
};

const TEXT = {
  no: { heading: "Mine bestillinger", none: "Du har ingen bestillinger her.", order: "Bestilling", date: "Dato" },
  en: { heading: "My orders", none: "You have no orders here.", order: "Order", date: "Date" },
} as const;

export default async function MyOrdersPage({ params }: { params: Promise<{ locale: "en" | "no" }> }) {
  const { locale } = await params;
  const t = TEXT[locale];
  const session = await getServerCustomerSession();
  if (!session) redirect(`/${locale}/min-bestilling/logg-inn`);

  const orders = await listCustomerOrders(session.accountId);
  if (orders.length === 1) redirect(`/${locale}/min-bestilling/${encodeURIComponent(orders[0].orderNumber)}`);

  return (
    <div className="py-16">
      <div className="flex max-w-2xl items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{t.heading}</h1>
        <CustomerLogoutButton locale={locale} />
      </div>
      {orders.length === 0 ? (
        <p className="mt-6 text-textColorThird">{t.none}</p>
      ) : (
        <ul className="mt-6 flex max-w-2xl flex-col gap-3">
          {orders.map((order) => (
            <li key={order.orderNumber}>
              <Link
                href={`/${locale}/min-bestilling/${encodeURIComponent(order.orderNumber)}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4 transition hover:border-logoblue"
              >
                <span>
                  <span className="font-semibold">
                    {t.order} #{order.orderNumber}
                  </span>
                  <span className="block text-sm text-textColorThird">
                    {[order.deliveryDate, order.timeWindow].filter(Boolean).join(" · ")}
                    {order.productsSummary ? ` — ${order.productsSummary}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-textColorThird">{customerStatusLabel(order.status, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
