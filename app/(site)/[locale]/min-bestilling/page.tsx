import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerCustomerSession } from "@/lib/customerAccounts/serverCustomerSession";
import { listCustomerOrders } from "@/lib/customerAccounts/customerOrderView";
import CustomerLogoutButton from "@/app/_components/site/pageComponents/myOrder/CustomerLogoutButton";
import CustomerPasswordForm from "@/app/_components/site/pageComponents/myOrder/CustomerPasswordForm";
import CustomerOrderCard from "@/app/_components/site/pageComponents/myOrder/CustomerOrderCard";
import ContactUsCard from "@/app/_components/site/pageComponents/myOrder/ContactUsCard";
import AutoRefresh from "@/app/_components/site/pageComponents/myOrder/AutoRefresh";

export const metadata: Metadata = {
  title: "Min bestilling | Otman AS",
  robots: { index: false, follow: false },
};

const TEXT = {
  no: {
    heading: "Mine bestillinger",
    intro: "Her ser du en oversikt over dine bestillinger hos Otman Transport.",
    none: "Du har ingen bestillinger her.",
  },
  en: {
    heading: "My orders",
    intro: "An overview of your orders with Otman Transport.",
    none: "You have no orders here.",
  },
} as const;

export default async function MyOrdersPage({ params }: { params: Promise<{ locale: "en" | "no" }> }) {
  const { locale } = await params;
  const t = TEXT[locale];
  const session = await getServerCustomerSession();
  if (!session) redirect(`/${locale}/min-bestilling/logg-inn`);

  const orders = await listCustomerOrders(session.accountId);

  return (
    <div className="mx-auto max-w-6xl py-12 sm:py-16">
      <AutoRefresh />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{t.heading}</h1>
          <p className="mt-3 text-lg text-textColorThird">{t.intro}</p>
        </div>
        <div className="flex items-center gap-5">
          <CustomerPasswordForm locale={locale} />
          <CustomerLogoutButton locale={locale} />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-gray-100 bg-white p-8 text-textColorThird">{t.none}</p>
        ) : (
          orders.map((order) => <CustomerOrderCard key={order.orderNumber} order={order} locale={locale} />)
        )}
        <ContactUsCard locale={locale} />
      </div>
    </div>
  );
}
