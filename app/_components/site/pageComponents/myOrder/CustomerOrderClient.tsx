"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WhiteGoodsBookingFlow } from "@/app/_components/site/BookingModal/whiteGoods/WhiteGoodsBookingFlow";
import { ProductIcon } from "@/app/_components/site/BookingModal/whiteGoods/productIcons";
import type { CustomerOrderDetails } from "@/lib/customerAccounts/customerOrderView";
import type { CustomerOrderProduct } from "@/lib/customerAccounts/customerOrderProducts";
import type { OrderProgress } from "@/lib/customerAccounts/orderProgress";
import { formatOrderDate } from "@/lib/orders/formatOrderDate";
import { localizeWebsiteLineLabel, localizeWebsiteProductName } from "@/lib/content/websiteLineLabels";
import CustomerOrderDetailsForm from "./CustomerOrderDetailsForm";
import OrderProgressBar from "./OrderProgressBar";
import AutoRefresh from "./AutoRefresh";
import ContactUsCard from "./ContactUsCard";
import { progressBadge } from "./orderProgressText";
import { orderRules } from "./orderRules";
import {
  ArrowLeftIcon,
  BoxIcon,
  BulbIcon,
  CalendarIcon,
  CheckIcon,
  CoinsIcon,
  CrossIcon,
  FlagIcon,
  MailIcon,
  NoteIcon,
  PhoneIcon,
  PinIcon,
  TruckIcon,
  UserIcon,
} from "./myOrderIcons";

type Props = {
  locale: "en" | "no";
  order: {
    orderNumber: string | null;
    status: string | null;
    createdAt: Date;
    customerName: string | null;
    phone: string | null;
    email: string | null;
    customerComments: string | null;
    pickupAddress: string | null;
    extraPickupAddress: string[];
    deliveryAddress: string | null;
    deliveryDate: string | null;
    timeWindow: string | null;
    productsSummary: string | null;
    deliveryTypeSummary: string | null;
    servicesSummary: string | null;
    totalIncVatNok: number | null;
    progress: OrderProgress;
  };
  products: CustomerOrderProduct[];
  details: CustomerOrderDetails;
  permissions: { open: boolean; beforeCutoff: boolean; cutoffAt: string | null; canEditItems: boolean };
};

const SOURCE_LABEL = {
  store: { no: "Butikk", en: "Store" },
  private: { no: "Privatperson", en: "Private individual" },
  business: { no: "Bedrift", en: "Business" },
} as const;

const CARD = "rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_rgba(16,24,40,0.04)] sm:p-7";

function CardTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
      <span className="text-logoblue">{icon}</span>
      {children}
    </h2>
  );
}

// One address in a light box, with any detail lines under it.
function AddressBox({ address, details = [] }: { address: string; details?: (string | null)[] }) {
  return (
    <div className="flex gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <PinIcon className="mt-0.5 h-5 w-5 shrink-0 text-logoblue" />
      <div className="min-w-0 wrap-anywhere">
        <p className="text-gray-900">{address}</p>
        {details.filter(Boolean).map((line) => (
          <p key={line} className="text-sm text-textColorThird">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

// "My order": the customer's own order, with what they may still change
// (lib/orders/customerOrderEditPolicy.ts) — everything until 24h before the
// time window, then only contact details and add-ons (e.g. unpacking while
// the crew is there). Every change goes straight onto the order and staff
// are told.
export default function CustomerOrderClient({ locale, order, products, details, permissions }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const orderNumber = order.orderNumber ?? "";
  const tag = locale === "no" ? "nb-NO" : "en-GB";

  const cutoffText = permissions.cutoffAt
    ? new Date(permissions.cutoffAt).toLocaleString(tag, { timeZone: "Europe/Oslo", dateStyle: "long", timeStyle: "short" })
    : null;
  const orderedAt = order.createdAt.toLocaleString(tag, { timeZone: "Europe/Oslo", dateStyle: "long", timeStyle: "short" });

  function saved(message: string) {
    setEditing(false);
    setNotice(message);
    setError("");
    router.refresh();
  }

  async function cancelOrder() {
    setCancelling(true);
    setError("");
    try {
      const res = await fetch(`/api/customer/orders/${encodeURIComponent(orderNumber)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: cancelMessage }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(t("Could not cancel. Please contact us.", "Kunne ikke kansellere. Ta kontakt med oss."));
        return;
      }
      setCancelOpen(false);
      setNotice(
        json.mode === "cancelled"
          ? t("Your order is cancelled.", "Bestillingen er kansellert.")
          : t(
              "We've received your cancellation request and will contact you.",
              "Vi har mottatt ønsket om å kansellere og tar kontakt med deg.",
            ),
      );
      router.refresh();
    } catch {
      setError(t("Could not cancel. Please contact us.", "Kunne ikke kansellere. Ta kontakt med oss."));
    } finally {
      setCancelling(false);
    }
  }

  const badge = progressBadge(order.progress, locale);
  const rules = orderRules({ ...permissions, cutoffText }, locale);

  // The stops as booked (catalog orders), or the plain addresses.
  const pickups =
    details.kind === "catalog"
      ? details.pickups.map((stop) => {
          const contact = [stop.contactName, stop.contactPhone].map((v) => v.trim()).filter(Boolean).join(", ");
          return {
            address: stop.address,
            details: [
              [
                stop.source ? SOURCE_LABEL[stop.source][locale] : null,
                stop.placeName || null,
                stop.floor !== null ? `${t("Floor", "Etasje")} ${stop.floor}, ${stop.liftAvailable ? t("with lift", "med heis") : t("no lift", "uten heis")}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || null,
              contact ? `${t("Contact person", "Kontaktperson")}: ${contact}` : null,
            ],
          };
        })
      : [order.pickupAddress, ...order.extraPickupAddress].filter((a): a is string => !!a).map((address) => ({ address, details: [] }));
  const deliveryDetail =
    details.kind === "catalog" && details.delivery.floor !== null
      ? `${t("Floor", "Etasje")} ${details.delivery.floor}, ${details.delivery.liftAvailable ? t("with lift", "med heis") : t("no lift", "uten heis")}`
      : null;

  const customerRows: { icon: ReactNode; label: string; value: string | null }[] = [
    { icon: <UserIcon className="h-5 w-5" />, label: t("Name", "Navn"), value: order.customerName },
    { icon: <PhoneIcon className="h-5 w-5" />, label: t("Phone", "Telefon"), value: order.phone },
    { icon: <MailIcon className="h-5 w-5" />, label: t("Email", "E-post"), value: order.email },
    { icon: <NoteIcon className="h-5 w-5" />, label: t("Your comment", "Kommentar fra kunde"), value: order.customerComments },
  ];

  return (
    <div className="mx-auto max-w-6xl py-10 sm:py-14">
      {!editing && <AutoRefresh />}

      <Link href={`/${locale}/min-bestilling`} className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-logoblue">
        <ArrowLeftIcon className="h-4 w-4" />
        {t("Back to my orders", "Tilbake til mine bestillinger")}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {t("Order", "Bestilling")} #{orderNumber}
            </h1>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${badge.className}`}>{badge.label}</span>
          </div>
          <p className="mt-1 text-textColorThird">
            {t("Ordered", "Bestilt")} {orderedAt}
          </p>
        </div>
        {permissions.open && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setNotice("");
                setCancelOpen(false);
                setEditing(true);
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 text-sm font-semibold text-logoblue transition hover:border-logoblue"
            >
              <CalendarIcon className="h-5 w-5" />
              {t("Change order", "Endre bestilling")}
            </button>
            <button
              type="button"
              onClick={() => setCancelOpen((open) => !open)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-500 bg-white px-5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <CrossIcon className="h-5 w-5" />
              {permissions.beforeCutoff ? t("Cancel order", "Avbestill bestilling") : t("Ask to cancel", "Be om å avbestille")}
            </button>
          </div>
        )}
      </div>

      {notice && <p className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{notice}</p>}
      {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

      {cancelOpen && permissions.open && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm">
          <p className="font-medium text-red-900">
            {permissions.beforeCutoff
              ? t("Are you sure? The order is cancelled straight away.", "Er du sikker? Bestillingen avbestilles med en gang.")
              : t(
                  "It's less than 24 hours until the job, so we'll contact you about the cancellation.",
                  "Det er mindre enn 24 timer til oppdraget, så vi tar kontakt med deg om avbestillingen.",
                )}
          </p>
          <textarea
            value={cancelMessage}
            onChange={(e) => setCancelMessage(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={t("Reason (optional)", "Årsak (valgfritt)")}
            className="w-full rounded-xl border border-gray-300 bg-white p-3"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={cancelOrder}
              disabled={cancelling}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-red-600 px-6 font-semibold text-white disabled:opacity-50"
            >
              {cancelling
                ? t("Sending…", "Sender…")
                : permissions.beforeCutoff
                  ? t("Yes, cancel the order", "Ja, avbestill bestillingen")
                  : t("Send cancellation request", "Send ønske om avbestilling")}
            </button>
            <button type="button" onClick={() => setCancelOpen(false)} className="h-11 px-4 font-semibold text-gray-700">
              {t("Keep the order", "Behold bestillingen")}
            </button>
          </div>
        </div>
      )}

      {editing && details.kind === "basic" && (
        <div className={`mt-5 ${CARD}`}>
          <CustomerOrderDetailsForm
            locale={locale}
            orderNumber={orderNumber}
            initial={{ customer: details.customer, preferredDate: details.preferredDate, timeWindow: details.timeWindow }}
            beforeCutoff={permissions.beforeCutoff}
            onCancel={() => setEditing(false)}
            onSaved={saved}
          />
        </div>
      )}

      <div className={`mt-6 ${CARD}`}>
        <OrderProgressBar progress={order.progress} locale={locale} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className={CARD}>
            <CardTitle icon={<CalendarIcon className="h-7 w-7" />}>{t("Time and addresses", "Tid og adresser")}</CardTitle>
            <dl className="mt-5 divide-y divide-gray-100 text-sm sm:text-base">
              <div className="grid gap-2 pb-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center">
                <dt className="flex items-center gap-3 font-semibold text-gray-900">
                  <CalendarIcon className="h-5 w-5 text-logoblue" />
                  {t("Date and time", "Dato og tidspunkt")}
                </dt>
                <dd className="text-gray-900">
                  {[order.deliveryDate ? formatOrderDate(order.deliveryDate, locale) : t("Not set", "Ikke satt"), order.timeWindow?.replace("-", " – ")]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </div>
              {pickups.length > 0 && (
                <div className="grid gap-2 py-4 sm:grid-cols-[200px_minmax(0,1fr)]">
                  <dt className="flex items-center gap-3 self-start pt-3 font-semibold text-gray-900">
                    <PinIcon className="h-5 w-5 text-logoblue" />
                    {pickups.length > 1 ? `${t("Pickup addresses", "Henteadresser")} (${pickups.length})` : t("Pickup address", "Henteadresse")}
                  </dt>
                  <dd className="flex flex-col gap-2">
                    {pickups.map((pickup, i) => (
                      <AddressBox key={i} address={pickup.address} details={pickup.details} />
                    ))}
                  </dd>
                </div>
              )}
              {order.deliveryAddress && (
                <div className="grid gap-2 pt-4 sm:grid-cols-[200px_minmax(0,1fr)]">
                  <dt className="flex items-center gap-3 self-start pt-3 font-semibold text-gray-900">
                    <FlagIcon className="h-5 w-5 text-logoblue" />
                    {t("Delivery address", "Leveringsadresse")}
                  </dt>
                  <dd>
                    <AddressBox address={order.deliveryAddress} details={[deliveryDetail]} />
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {products.length > 0 && (
            <section className={CARD}>
              <CardTitle icon={<BoxIcon className="h-7 w-7" />}>{t("Products and services", "Varer og tjenester")}</CardTitle>
              <ul className="mt-5 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => {
                  const name = localizeWebsiteProductName(product.name, locale);
                  return (
                    <li key={product.cardId} className="flex flex-col rounded-xl border border-gray-100 p-3">
                      <div className="relative flex h-24 w-full items-center justify-center rounded-lg bg-slate-50">
                        <ProductIcon code={product.code} iconKey={product.iconKey} className="h-14 w-14 text-logoblue" />
                        {product.count > 1 && (
                          <span className="absolute right-2 top-2 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-900 shadow-sm">
                            x{product.count}
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-center font-semibold text-gray-900">
                        {product.itemName ?? name}
                        {product.count > 1 ? ` x${product.count}` : ""}
                      </p>
                      {product.itemName && <p className="text-center text-xs text-textColorThird">{name}</p>}
                      {(product.deliveryType || product.services.length > 0) && (
                        <ul className="mt-3 flex flex-col gap-1.5 border-t border-gray-100 pt-3 text-sm">
                          {product.deliveryType && (
                            <li className="flex gap-2 font-medium text-logoblue">
                              <TruckIcon className="mt-0.5 h-4 w-4 shrink-0" />
                              {localizeWebsiteLineLabel(product.deliveryType, locale)}
                            </li>
                          )}
                          {product.services.map((service) => (
                            <li key={service} className="flex gap-2 text-gray-700">
                              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-logoblue" strokeWidth={2} />
                              {localizeWebsiteLineLabel(service, locale)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className={CARD}>
            <CardTitle icon={<UserIcon className="h-7 w-7" />}>{t("Customer information", "Kundeinformasjon")}</CardTitle>
            <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
              {customerRows.map((row, i) => (
                // The comment (last) gets its own full-width row.
                <div
                  key={row.label}
                  className={`flex min-w-0 gap-3 ${i === customerRows.length - 1 ? "border-t border-gray-100 pt-5 sm:col-span-full" : ""}`}
                >
                  <span className="mt-0.5 text-gray-700">{row.icon}</span>
                  <div className="min-w-0 wrap-anywhere">
                    <dt className="font-semibold text-gray-900">{row.label}</dt>
                    <dd className="mt-1 whitespace-pre-line text-gray-700">{row.value || "—"}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          {order.totalIncVatNok !== null && (
            <section className="flex items-center gap-5 rounded-2xl bg-blue-50 p-6">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-logoblue">
                <CoinsIcon className="h-8 w-8" />
              </span>
              <div>
                <p className="font-semibold text-logoblue">{t("Total (incl. VAT)", "Totalt (inkl. mva.)")}</p>
                <p className="text-4xl font-bold text-gray-900">{order.totalIncVatNok.toLocaleString("nb-NO")} kr</p>
              </div>
            </section>
          )}

          <section className={CARD}>
            <CardTitle icon={<BulbIcon className="h-7 w-7" />}>{t("Good to know", "Godt å vite")}</CardTitle>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-gray-700">
              {rules.map((rule) => (
                <li key={rule} className="flex gap-3">
                  <CheckIcon className="h-5 w-5 shrink-0 text-logoblue" strokeWidth={2} />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </section>

          <ContactUsCard locale={locale} stacked />
        </aside>
      </div>

      {editing && details.kind === "catalog" && (
        <WhiteGoodsBookingFlow
          locale={locale}
          onClose={() => setEditing(false)}
          customer={{ orderNumber, beforeCutoff: permissions.beforeCutoff, onSaved: saved }}
        />
      )}
    </div>
  );
}
