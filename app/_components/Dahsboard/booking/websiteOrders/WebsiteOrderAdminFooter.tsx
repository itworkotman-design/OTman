"use client";

import { useEffect, useRef, useState } from "react";
import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { AdminOrderDetails } from "@/lib/orders/websiteOrderDetailsEdit";
import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import { formatKr } from "@/lib/orders/orderChangeText";
import WebsiteOrderPaymentSummary from "./WebsiteOrderPaymentSummary";

type Props = {
  orderId: string;
  productCards: SavedProductCard[];
  details: AdminOrderDetails;
  // The order as it was opened, compared with its payments (from GET).
  initialComparison: OrderPaymentComparison;
  gsmSentAt: string | null;
  locale: BookingUiLocale;
  onCancel: () => void;
  // After a successful save — the caller closes the editor and reloads.
  onSaved: (message: string) => void;
};

const PREVIEW_DELAY_MS = 800;

// The save bar of the booking flow when an admin edits an existing website
// order: every change is priced server-side (dryRun) and compared with what
// the customer has paid, so the exact difference is visible before "Save
// order" or "Save & send payment link". Nothing is required — an admin can
// save the order in any state.
export default function WebsiteOrderAdminFooter({
  orderId,
  productCards,
  details,
  initialComparison,
  gsmSentAt,
  locale,
  onCancel,
  onSaved,
}: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const [comparison, setComparison] = useState<OrderPaymentComparison | null>(initialComparison);
  const [previewing, setPreviewing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"save" | "send" | null>(null);
  const [error, setError] = useState("");
  const previewSeq = useRef(0);
  const firstRender = useRef(true);

  const reasonText: Record<string, string> = {
    FORBIDDEN: t("Only admins can change website orders.", "Kun administratorer kan endre nettsidebestillinger."),
    UNKNOWN_PRODUCT: t("One of the products isn't sold on the website.", "En av varene selges ikke på nettsiden."),
    NOT_EDITABLE_STATUS: t(
      "This order is closed and can't be changed.",
      "Denne bestillingen er avsluttet og kan ikke endres.",
    ),
    MISSING_CUSTOMER_EMAIL: t("The order has no customer email.", "Bestillingen har ingen kunde-e-post."),
    NOTHING_TO_PAY: t(
      "The customer has already paid the new total — no link to send.",
      "Kunden har allerede betalt ny total — ingen lenke å sende.",
    ),
    NOT_PAYABLE_STATUS: t(
      "A payment link can't be sent for this order's status.",
      "Betalingslenke kan ikke sendes for denne statusen.",
    ),
  };
  const fieldText: Record<string, string> = {
    "customer.name": t("Name", "Navn"),
    "customer.phone": t("Phone", "Telefon"),
    "customer.email": t("Email", "E-post"),
    "customer.comments": t("Comments", "Merknader"),
  };
  function errorMessage(json: { reason?: string; errors?: Record<string, string> } | null) {
    if (json?.reason === "INVALID_DETAILS" && json.errors) {
      const fields = Object.keys(json.errors).map((key) => fieldText[key] ?? key);
      return t(`Check the format of: ${fields.join(", ")}`, `Sjekk formatet på: ${fields.join(", ")}`);
    }
    return (json?.reason && reasonText[json.reason]) || t("Couldn't save the order.", "Kunne ikke lagre bestillingen.");
  }

  async function send(body: Record<string, unknown>) {
    const res = await fetch(`/api/orders/${orderId}/website-items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ productCards, details, ...body }),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok && !!json?.ok, json };
  }

  // Price every change (debounced) against what was paid. Keyed on the
  // content: the flow builds a new details object on every render.
  const payloadKey = JSON.stringify({ productCards, details });
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setDirty(true);
    const seq = ++previewSeq.current;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const { ok, json } = await send({ dryRun: true });
        if (seq !== previewSeq.current) return;
        setComparison(ok ? json.comparison : null);
        setError(ok ? "" : errorMessage(json));
      } catch {
        if (seq === previewSeq.current) setComparison(null);
      } finally {
        if (seq === previewSeq.current) setPreviewing(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey]);

  async function save(sendPaymentLink: boolean) {
    setError("");
    const email = details.customer.email;
    if (sendPaymentLink && !confirm(t(`Save and send the payment link to ${email}?`, `Lagre og sende betalingslenke til ${email}?`))) {
      return;
    }
    try {
      setSaving(sendPaymentLink ? "send" : "save");
      const { ok, json } = await send({ sendPaymentLink });
      if (!ok) {
        setError(errorMessage(json));
        return;
      }
      const result = json.comparison as OrderPaymentComparison;
      const parts = [t("Order saved.", "Bestillingen er lagret.")];
      if (result.outcome === "due") {
        parts.push(t(`Customer owes ${formatKr(result.differenceIncVatNok)}.`, `Kunden skylder ${formatKr(result.differenceIncVatNok)}.`));
      }
      if (result.outcome === "refund") {
        parts.push(
          t(
            `Customer overpaid ${formatKr(-result.differenceIncVatNok)} — refund manually in Stripe.`,
            `Kunden har betalt ${formatKr(-result.differenceIncVatNok)} for mye — refunder manuelt i Stripe.`,
          ),
        );
      }
      if (json.emailSent) parts.push(t("Payment link sent.", "Betalingslenke sendt."));
      if (json.emailFailed) parts.push(t("The payment email failed — try again.", "Betalings-e-posten feilet — prøv igjen."));
      if (gsmSentAt) parts.push(t("Remember to update it in GSM.", "Husk å oppdatere i GSM."));
      onSaved(parts.join(" "));
    } catch {
      setError(t("Couldn't save the order.", "Kunne ikke lagre bestillingen."));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
      <div className="max-h-48 min-w-0 flex-1 overflow-y-auto">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-logoblue">
            {dirty ? t("Price after your changes", "Pris etter endringene") : t("Payment status", "Betalingsstatus")}
          </p>
          {previewing && <span className="text-xs text-black/50">{t("Calculating…", "Beregner…")}</span>}
        </div>
        {comparison ? (
          <WebsiteOrderPaymentSummary
            comparison={comparison}
            locale={locale}
            totalLabel={dirty ? t("New total (incl. VAT)", "Ny total (inkl. MVA)") : undefined}
          />
        ) : (
          !previewing && <p className="text-sm text-black/50">{t("No price yet.", "Ingen pris ennå.")}</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 lg:w-72">
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving !== null}
          className="inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving === "save" ? t("Saving…", "Lagrer…") : t("Save order", "Lagre bestilling")}
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={saving !== null || !details.customer.email}
          title={details.customer.email ? undefined : t("The order has no customer email.", "Bestillingen har ingen kunde-e-post.")}
          className="inline-flex h-11 items-center justify-center rounded-full border border-logoblue px-5 text-sm font-semibold text-logoblue disabled:opacity-50"
        >
          {saving === "send" ? t("Sending…", "Sender…") : t("Save & send payment link", "Lagre og send betalingslenke")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving !== null}
          className="text-sm font-semibold text-black/60 hover:text-black disabled:opacity-50"
        >
          {t("Cancel", "Avbryt")}
        </button>
      </div>
    </div>
  );
}
