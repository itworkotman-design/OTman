"use client";

import { useEffect, useState } from "react";
import { WhiteGoodsProductCard } from "@/app/_components/site/BookingModal/whiteGoods/WhiteGoodsProductCard";
import { previewCardDeliveryOptions } from "@/app/_components/site/BookingModal/whiteGoods/deliveryPricePreview";
import { normalizeSavedProductCard, type CatalogProduct, type SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { Locale } from "@/lib/content/ServiceWindowContent";

type Props = {
  token: string;
  locale: Locale;
};

type LoadedData = {
  displayId: number | null;
  productsSummary: string | null;
  productCards: SavedProductCard[];
  catalogProducts: CatalogProduct[];
};

type Phase = "closed" | "loading" | "unavailable" | "editing" | "submitting" | "result";

const TEXT = {
  no: {
    toggle: "Glemte du noe?",
    intro: "Du kan endre leveringsmåte og tilleggstjenester for varene i bestillingen din. Eventuell prisøkning betales separat.",
    review: "Se over endringene",
    cancel: "Avbryt",
    submitError: "Kunne ikke oppdatere bestillingen. Prøv igjen, eller ta kontakt med oss.",
    decreaseError: "Denne endringen ville redusert totalprisen. Ta kontakt med oss om du ønsker en refusjon.",
    noChange: "Bestillingen din er oppdatert. Ingen prisendring.",
    increased: "Bestillingen din er oppdatert. Du må betale differansen under.",
    previousTotal: "Tidligere pris (eks. MVA)",
    newTotal: "Ny pris (eks. MVA)",
    difference: "Differanse",
    payDifference: "Betal differansen",
    close: "Lukk",
  },
  en: {
    toggle: "Forgot something?",
    intro: "You can change the delivery method and add-ons for the items in your order. Any price increase is paid separately.",
    review: "Review changes",
    cancel: "Cancel",
    submitError: "Could not update the order. Please try again, or contact us.",
    decreaseError: "This change would have reduced the total price. Contact us if you'd like a refund.",
    noChange: "Your order has been updated. No price change.",
    increased: "Your order has been updated. Please pay the difference below.",
    previousTotal: "Previous price (ex. VAT)",
    newTotal: "New price (ex. VAT)",
    difference: "Difference",
    payDifference: "Pay the difference",
    close: "Close",
  },
} as const;

export default function OrderItemEditorClient({ token, locale }: Props) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [data, setData] = useState<LoadedData | null>(null);
  const [cards, setCards] = useState<SavedProductCard[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<{ previousPriceExVat: number; newPriceExVat: number; deltaExVat: number } | null>(null);
  const t = TEXT[locale];

  useEffect(() => {
    if (phase !== "loading") return;

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/public/orders/${token}/edit-items`);
        const json = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok || !json?.ok) {
          setPhase("unavailable");
          return;
        }

        const normalizedCards = (json.productCards as SavedProductCard[]).map((card: SavedProductCard, index: number) =>
          normalizeSavedProductCard(card, index),
        );

        setData({
          displayId: json.displayId ?? null,
          productsSummary: json.productsSummary ?? null,
          productCards: normalizedCards,
          catalogProducts: json.catalogProducts as CatalogProduct[],
        });
        setCards(normalizedCards);
        setPhase("editing");
      } catch {
        if (!cancelled) setPhase("unavailable");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [phase, token]);

  function updateCard(next: SavedProductCard) {
    setCards((prev) => prev.map((card) => (card.cardId === next.cardId ? next : card)));
  }

  async function handleSubmit() {
    setPhase("submitting");
    setSubmitError("");

    try {
      const res = await fetch(`/api/public/orders/${token}/edit-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productCards: cards }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setSubmitError(json?.reason === "WOULD_DECREASE_PRICE" ? t.decreaseError : t.submitError);
        setPhase("editing");
        return;
      }

      setResult({
        previousPriceExVat: json.previousPriceExVat,
        newPriceExVat: json.newPriceExVat,
        deltaExVat: json.deltaExVat,
      });
      setPhase("result");
    } catch {
      setSubmitError(t.submitError);
      setPhase("editing");
    }
  }

  if (phase === "closed") {
    return (
      <button type="button" onClick={() => setPhase("loading")} className="customButtonDefault mt-4 h-10 w-full">
        {t.toggle}
      </button>
    );
  }

  if (phase === "loading") {
    return null;
  }

  // Not every confirmed order has catalog-priced items to reconfigure (e.g.
  // Moving/special-goods/services orders) — the API is the source of truth
  // for that, so an "unavailable" response here just means this section
  // isn't offered, not an error to surface.
  if (phase === "unavailable") {
    return null;
  }

  if (phase === "result" && result) {
    return (
      <div className="mt-6 rounded-lg border border-gray-200 p-6">
        <p className="text-sm font-medium text-green-700">
          {result.deltaExVat > 0 ? t.increased : t.noChange}
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-textColorThird">{t.previousTotal}</dt>
            <dd className="font-medium">{result.previousPriceExVat.toLocaleString("nb-NO")} kr</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-textColorThird">{t.newTotal}</dt>
            <dd className="font-medium">{result.newPriceExVat.toLocaleString("nb-NO")} kr</dd>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2">
            <dt className="text-textColorThird">{t.difference}</dt>
            <dd className="font-semibold">{result.deltaExVat.toLocaleString("nb-NO")} kr</dd>
          </div>
        </dl>
        {result.deltaExVat > 0 && (
          <a href={`/${locale}/betaling/${token}`} className="customButtonEnabled mt-4 flex h-11 items-center justify-center px-6">
            {t.payDifference}
          </a>
        )}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mt-6">
      <p className="text-sm text-textColorThird">{t.intro}</p>

      <div className="mt-4 flex flex-col gap-4">
        {cards.map((card) => {
          const product = data.catalogProducts.find((p) => p.id === card.productId);
          if (!product) return null;
          return (
            <WhiteGoodsProductCard
              key={card.cardId}
              locale={locale}
              product={product}
              value={card}
              deliveryPreview={previewCardDeliveryOptions(cards, data.catalogProducts, card.cardId)}
              onChange={updateCard}
            />
          );
        })}
      </div>

      {submitError && <p className="mt-4 text-sm font-medium text-red-600">{submitError}</p>}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={phase === "submitting"}
          className="customButtonEnabled h-11 px-6 disabled:opacity-50!"
        >
          {phase === "submitting" ? "..." : t.review}
        </button>
        <button
          type="button"
          onClick={() => {
            setCards(data.productCards);
            setPhase("closed");
          }}
          className="customButtonDefault h-11 px-6"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
