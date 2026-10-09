import Link from "next/link";
import type { OrderProgress } from "@/lib/customerAccounts/orderProgress";
import { formatOrderDate } from "@/lib/orders/formatOrderDate";
import { getOsloDateKey } from "@/lib/dates/isoDate";
import { localizeProductsSummary, localizeWebsiteLineLabelList } from "@/lib/content/websiteLineLabels";
import OrderProgressBar from "./OrderProgressBar";
import { progressBadge } from "./orderProgressText";
import { ArrowRightIcon, CalendarIcon, PinIcon, TruckIcon } from "./myOrderIcons";

export type CustomerOrderCardOrder = {
  orderNumber: string;
  createdAt: Date;
  deliveryDate: string | null;
  timeWindow: string | null;
  pickupAddress: string | null;
  extraPickupCount: number;
  deliveryAddress: string | null;
  productsSummary: string | null;
  deliveryTypeSummary: string | null;
  progress: OrderProgress;
};

type Props = { order: CustomerOrderCardOrder; locale: "no" | "en" };

// One order on "Mine bestillinger": number, status, date, route, what is
// delivered, and the progress bar.
export default function CustomerOrderCard({ order, locale }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const href = `/${locale}/min-bestilling/${encodeURIComponent(order.orderNumber)}`;
  const badge = progressBadge(order.progress, locale);
  const deliveryTypes = localizeWebsiteLineLabelList(order.deliveryTypeSummary, locale);
  const products = localizeProductsSummary(order.productsSummary, locale);

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_rgba(16,24,40,0.04)] sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">
            {t("Order", "Bestilling")} #{order.orderNumber}
          </h2>
          <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
        </div>
        <p className="text-sm text-textColorThird">
          {t("Ordered", "Bestilt")} {formatOrderDate(getOsloDateKey(order.createdAt), locale)}
        </p>
      </header>

      <div className="mt-6 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)_minmax(0,1.1fr)] lg:gap-8">
        <div className="flex gap-3">
          <CalendarIcon className="h-6 w-6 shrink-0 text-logoblue" />
          <div>
            <p className="font-semibold text-gray-900">
              {order.deliveryDate ? formatOrderDate(order.deliveryDate, locale) : t("Date not set", "Dato ikke satt")}
            </p>
            {order.timeWindow && <p className="text-textColorThird">{order.timeWindow.replace("-", " – ")}</p>}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-start lg:col-span-1">
          <div className="flex min-w-0 flex-1 gap-3">
            <PinIcon className="h-6 w-6 shrink-0 text-logoblue" />
            <div className="min-w-0 wrap-anywhere">
              <p className="text-gray-900">{order.pickupAddress || t("Pickup not set", "Henteadresse ikke satt")}</p>
              {order.extraPickupCount > 0 && (
                <p className="text-textColorThird">
                  +{order.extraPickupCount} {order.extraPickupCount === 1 ? t("more pickup", "hentested til") : t("more pickups", "hentesteder til")}
                </p>
              )}
            </div>
          </div>
          <ArrowRightIcon className="hidden h-6 w-6 shrink-0 text-gray-700 sm:block" />
          <div className="flex min-w-0 flex-1 gap-3">
            <PinIcon className="h-6 w-6 shrink-0 text-logoblue" />
            <p className="min-w-0 text-gray-900 wrap-anywhere">
              {order.deliveryAddress || t("Delivery not set", "Leveringsadresse ikke satt")}
            </p>
          </div>
        </div>

        {(deliveryTypes || products) && (
          <div className="flex gap-3">
            <TruckIcon className="h-6 w-6 shrink-0 text-logoblue" />
            <div className="min-w-0">
              {deliveryTypes && <p className="line-clamp-2 font-semibold text-gray-900">{deliveryTypes}</p>}
              {products && <p className="line-clamp-2 text-textColorThird" title={products}>{products}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <OrderProgressBar progress={order.progress} locale={locale} />
      </div>

      <footer className="mt-8">
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-logoblue transition hover:border-logoblue"
        >
          <CalendarIcon className="h-5 w-5" />
          {t("See details", "Se detaljer")}
        </Link>
      </footer>
    </article>
  );
}
