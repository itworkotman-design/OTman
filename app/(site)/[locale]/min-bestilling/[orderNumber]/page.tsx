import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerCustomerSession } from "@/lib/customerAccounts/serverCustomerSession";
import { customerOrderView, findCustomerOrder, findCustomerOrderProducts } from "@/lib/customerAccounts/customerOrderView";
import CustomerOrderClient from "@/app/_components/site/pageComponents/myOrder/CustomerOrderClient";

export const metadata: Metadata = {
  title: "Min bestilling | Otman AS",
  robots: { index: false, follow: false },
};

const TEXT = {
  no: { notFound: "Fant ikke bestillingen på denne innloggingen.", back: "Mine bestillinger" },
  en: { notFound: "We couldn't find that order on this login.", back: "My orders" },
} as const;

export default async function MyOrderPage({ params }: { params: Promise<{ locale: "en" | "no"; orderNumber: string }> }) {
  const { locale, orderNumber: rawNumber } = await params;
  const orderNumber = decodeURIComponent(rawNumber);
  const t = TEXT[locale];

  const session = await getServerCustomerSession();
  if (!session) {
    redirect(`/${locale}/min-bestilling/logg-inn?next=${encodeURIComponent(`/${locale}/min-bestilling/${rawNumber}`)}`);
  }

  const order = await findCustomerOrder(session.accountId, orderNumber);
  if (!order) {
    return (
      <div className="py-16 text-center">
        <p className="text-textColorThird">{t.notFound}</p>
        <Link href={`/${locale}/min-bestilling`} className="mt-4 inline-block font-semibold text-logoblue">
          {t.back}
        </Link>
      </div>
    );
  }

  const view = customerOrderView(order);
  const products = await findCustomerOrderProducts(order);
  return (
    <CustomerOrderClient
      locale={locale}
      order={view.order}
      products={products}
      accountEmail={session.email}
      details={view.details}
      permissions={{ ...view.permissions, cutoffAt: view.permissions.cutoffAt?.toISOString() ?? null }}
    />
  );
}
