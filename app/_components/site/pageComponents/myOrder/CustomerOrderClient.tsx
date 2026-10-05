"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WhiteGoodsBookingFlow } from "@/app/_components/site/BookingModal/whiteGoods/WhiteGoodsBookingFlow";
import type { CustomerOrderDetails } from "@/lib/customerAccounts/customerOrderView";
import CustomerOrderDetailsForm from "./CustomerOrderDetailsForm";
import CustomerLogoutButton from "./CustomerLogoutButton";
import CustomerPasswordForm from "./CustomerPasswordForm";
import { customerStatusLabel } from "./customerStatusLabel";

type Props = {
  locale: "en" | "no";
  order: {
    orderNumber: string | null;
    status: string | null;
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
    totalIncVatNok: number | null;
  };
  details: CustomerOrderDetails;
  permissions: { open: boolean; beforeCutoff: boolean; cutoffAt: string | null; canEditItems: boolean };
};

// "My order": the customer's own order, with what they may still change
// (lib/orders/customerOrderEditPolicy.ts) — everything until 24h before the
// time window, then only contact details and add-ons (e.g. unpacking while
// the crew is there). Every change goes straight onto the order and staff
// are told.
export default function CustomerOrderClient({ locale, order, details, permissions }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const orderNumber = order.orderNumber ?? "";

  const cutoffText = permissions.cutoffAt
    ? new Date(permissions.cutoffAt).toLocaleString(locale === "no" ? "nb-NO" : "en-GB", {
        timeZone: "Europe/Oslo",
        dateStyle: "long",
        timeStyle: "short",
      })
    : null;

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

  const rows: [string, string | null][] = [
    [t("Status", "Status"), customerStatusLabel(order.status, locale)],
    [t("Date", "Dato"), [order.deliveryDate, order.timeWindow].filter(Boolean).join(" · ") || null],
    [t("Pickup", "Henting"), [order.pickupAddress, ...order.extraPickupAddress].filter(Boolean).join("\n") || null],
    [t("Delivery", "Levering"), order.deliveryAddress],
    [t("Products", "Varer"), order.productsSummary],
    [t("Name", "Navn"), order.customerName],
    [t("Phone", "Telefon"), order.phone],
    [t("Email", "E-post"), order.email],
    [t("Comment", "Kommentar"), order.customerComments],
    [t("Total (incl. VAT)", "Totalpris (inkl. MVA)"), order.totalIncVatNok !== null ? `${order.totalIncVatNok.toLocaleString("nb-NO")} kr` : null],
  ];

  return (
    <div className="py-16">
      <div className="flex max-w-3xl flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">
          {t("Order", "Bestilling")} #{orderNumber}
        </h1>
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/min-bestilling`} className="text-sm font-semibold text-logoblue">
            {t("My orders", "Mine bestillinger")}
          </Link>
          <CustomerLogoutButton locale={locale} />
        </div>
      </div>

      {notice && <p className="mt-6 max-w-3xl rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{notice}</p>}
      {error && <p className="mt-6 max-w-3xl rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

      <div className="mt-6 max-w-3xl rounded-lg border border-gray-200 p-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {rows
            .filter((row): row is [string, string] => !!row[1])
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-textColorThird">{label}</dt>
                <dd className="whitespace-pre-line font-medium">{value}</dd>
              </div>
            ))}
        </dl>
      </div>

      <div className="mt-6 max-w-3xl rounded-lg border border-gray-200 p-6 text-sm">
        {!permissions.open ? (
          <p className="text-textColorThird">
            {t(
              "This order can't be changed any more. Questions? Reply to one of our emails or call +47 402 84 977.",
              "Denne bestillingen kan ikke endres lenger. Spørsmål? Svar på en av e-postene våre eller ring +47 402 84 977.",
            )}
          </p>
        ) : permissions.beforeCutoff ? (
          <p className="text-textColorThird">
            {cutoffText
              ? t(
                  `You can change anything until ${cutoffText}. After that you can still change your contact details and add services such as unpacking.`,
                  `Du kan endre alt frem til ${cutoffText}. Etter det kan du fortsatt endre kontaktinformasjon og legge til tjenester som utpakking.`,
                )
              : t("You can change your order here.", "Du kan endre bestillingen her.")}
          </p>
        ) : (
          <p className="text-textColorThird">
            {t(
              "It's less than 24 hours until the job. You can still change your contact details and add services such as unpacking — for anything else, contact us.",
              "Det er mindre enn 24 timer til oppdraget. Du kan fortsatt endre kontaktinformasjon og legge til tjenester som utpakking — ta kontakt for andre endringer.",
            )}
          </p>
        )}

        {permissions.open && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setNotice("");
                setEditing(true);
              }}
              className="inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white"
            >
              {t("Change order", "Endre bestilling")}
            </button>
            <button
              type="button"
              onClick={() => setCancelOpen((open) => !open)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-red-600 px-6 text-sm font-semibold text-red-600"
            >
              {permissions.beforeCutoff ? t("Cancel order", "Kanseller bestilling") : t("Ask to cancel", "Be om å kansellere")}
            </button>
          </div>
        )}

        {cancelOpen && permissions.open && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg bg-red-50 p-4">
            <p>
              {permissions.beforeCutoff
                ? t("Are you sure? The order is cancelled straight away.", "Er du sikker? Bestillingen kanselleres med en gang.")
                : t(
                    "It's less than 24 hours until the job, so we'll contact you about the cancellation.",
                    "Det er mindre enn 24 timer til oppdraget, så vi tar kontakt med deg om kanselleringen.",
                  )}
            </p>
            <textarea
              value={cancelMessage}
              onChange={(e) => setCancelMessage(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={t("Reason (optional)", "Årsak (valgfritt)")}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm"
            />
            <button
              type="button"
              onClick={cancelOrder}
              disabled={cancelling}
              className="self-start inline-flex h-11 items-center justify-center rounded-full bg-red-600 px-6 text-sm font-semibold text-white disabled:opacity-50"
            >
              {cancelling
                ? t("Sending…", "Sender…")
                : permissions.beforeCutoff
                  ? t("Yes, cancel the order", "Ja, kanseller bestillingen")
                  : t("Send cancellation request", "Send ønske om kansellering")}
            </button>
          </div>
        )}

        {editing && details.kind === "basic" && (
          <div className="mt-6">
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
      </div>

      {editing && details.kind === "catalog" && (
        <WhiteGoodsBookingFlow
          locale={locale}
          onClose={() => setEditing(false)}
          customer={{ orderNumber, beforeCutoff: permissions.beforeCutoff, onSaved: saved }}
        />
      )}

      <CustomerPasswordForm locale={locale} />
    </div>
  );
}
