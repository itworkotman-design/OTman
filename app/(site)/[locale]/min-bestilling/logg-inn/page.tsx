import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerCustomerSession, safeMyOrderPath } from "@/lib/customerAccounts/serverCustomerSession";
import CustomerLoginClient from "@/app/_components/site/pageComponents/myOrder/CustomerLoginClient";

export const metadata: Metadata = {
  title: "Min bestilling — logg inn | Otman AS",
  robots: { index: false, follow: false },
};

export default async function CustomerLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: "en" | "no" }>;
  searchParams: Promise<{ next?: string; glemt?: string }>;
}) {
  const { locale } = await params;
  const { next, glemt } = await searchParams;
  const target = safeMyOrderPath(locale, next);

  if (await getServerCustomerSession()) redirect(target);

  return <CustomerLoginClient locale={locale} next={target} startWithForgot={glemt === "1"} />;
}
