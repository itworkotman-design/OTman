"use client";

import { useEffect, useState } from "react";
import type { Membership } from "@/lib/users/types";
import GdprSection from "./GdprSection";

type DashboardStats = {
  totalIncome: number;
  ordersThisMonth: number;
  completedOrders: number;
  activeOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  cancelledOrders: number;
  bookingEmailCount: number;
};

type DashboardResponse = {
  ok: boolean;
  stats: DashboardStats;
  orderEmailsEnabled: boolean;
  monthlyRevenue: MonthlyRevenueItem[];
  monthlyComparison: MonthlyComparisonItem[];
  currentYear: number;
  lastYear: number;
  reason?: string;
};

type MonthlyRevenueItem = {
  month: number;
  monthLabel: string;
  subcontractor: number;
  profit: number;
  lastYearSubcontractor: number;
  lastYearProfit: number;
};

type MonthlyComparisonItem = {
  month: number;
  monthLabel: string;
  currentYearOrders: number;
  lastYearOrders: number;
};

type MembershipsResponse = {
  ok: boolean;
  memberships: Membership[];
  reason?: string;
};

type FinishMonthResponse = {
  ok: boolean;
  sentCount?: number;
  skippedCount?: number;
  message?: string;
  reason?: string;
};

type OrderEmailSettingResponse = {
  ok: boolean;
  orderEmailsEnabled?: boolean;
  reason?: string;
};

function formatNOK(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(value);
}

function getOnlineMemberLabel(member: Membership) {
  return member.user.username?.trim() || member.user.email;
}

function niceCeil(value: number) {
  if (value <= 0) {
    return 1;
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;

  let niceNormalized;
  if (normalized <= 1) {
    niceNormalized = 1;
  } else if (normalized <= 2) {
    niceNormalized = 2;
  } else if (normalized <= 5) {
    niceNormalized = 5;
  } else {
    niceNormalized = 10;
  }

  return niceNormalized * magnitude;
}

function MonthlyOrdersComparisonChart({ items, currentYear, lastYear }: { items: MonthlyComparisonItem[]; currentYear: number; lastYear: number }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartWidth = 720;
  const chartHeight = 220;
  const leftPadding = 34;
  const topPadding = 20;
  const bottomPadding = 28;
  const plotHeight = chartHeight - topPadding - bottomPadding;
  const barColor = "#3B82F6";
  const lineColor = "#64748B";

  const rawMax = items.reduce((max, item) => Math.max(max, item.currentYearOrders, item.lastYearOrders), 0);
  const niceMax = niceCeil(rawMax);
  const bandWidth = (chartWidth - leftPadding) / Math.max(items.length, 1);
  const barWidth = Math.min(24, bandWidth * 0.45);

  const valueToY = (value: number) => chartHeight - bottomPadding - (value / niceMax) * plotHeight;

  const linePoints = items.map((item, index) => ({
    x: leftPadding + bandWidth * index + bandWidth / 2,
    y: valueToY(item.lastYearOrders),
  }));
  const polylinePoints = linePoints.map((point) => `${point.x},${point.y}`).join(" ");

  const totalCurrentYear = items.reduce((sum, item) => sum + item.currentYearOrders, 0);
  const totalLastYear = items.reduce((sum, item) => sum + item.lastYearOrders, 0);
  const delta = totalCurrentYear - totalLastYear;
  const deltaPercent = totalLastYear > 0 ? (delta / totalLastYear) * 100 : null;
  const yTicks = [0, niceMax / 2, niceMax];

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-logoblue">Orders</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            {totalCurrentYear} orders in {currentYear}
          </span>
          {deltaPercent !== null ? (
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
            >
              {delta >= 0 ? "+" : ""}
              {deltaPercent.toFixed(0)}% vs {lastYear}
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-5 text-xs font-medium text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: barColor }} />
            {currentYear} orders
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: lineColor }} />
            {lastYear} orders
          </span>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-50 p-3" onMouseLeave={() => setHoveredIndex(null)}>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="h-56 w-full"
            preserveAspectRatio="none"
            aria-label="Monthly orders this year compared to last year"
          >
            {yTicks.map((tick) => (
              <g key={`tick-${tick}`}>
                <line x1={leftPadding} y1={valueToY(tick)} x2={chartWidth} y2={valueToY(tick)} stroke="#E1E0D9" strokeWidth="1" />
                <text x={leftPadding - 6} y={valueToY(tick)} dy={tick === 0 ? -2 : 4} textAnchor="end" className="fill-slate-400 text-[10px]">
                  {Math.round(tick)}
                </text>
              </g>
            ))}

            {items.map((item, index) => {
              const barHeight = (item.currentYearOrders / niceMax) * plotHeight;
              const x = leftPadding + bandWidth * index + (bandWidth - barWidth) / 2;
              const y = chartHeight - bottomPadding - barHeight;
              const isHovered = hoveredIndex === index;

              return (
                <g key={`bar-${item.month}`}>
                  <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 0)} rx={4} fill={barColor} opacity={isHovered ? 1 : 0.85} />
                  {barHeight > 8 ? (
                    <rect x={x} y={y + Math.max(barHeight - 4, 0)} width={barWidth} height={4} fill={barColor} opacity={isHovered ? 1 : 0.85} />
                  ) : null}
                  <rect
                    x={leftPadding + bandWidth * index}
                    y={topPadding}
                    width={bandWidth}
                    height={plotHeight}
                    fill="transparent"
                    onMouseEnter={() => setHoveredIndex(index)}
                  />
                </g>
              );
            })}

            <polyline fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={polylinePoints} />

            {linePoints.map((point, index) => (
              <circle
                key={`dot-${items[index]?.month ?? index}`}
                cx={point.x}
                cy={point.y}
                r={hoveredIndex === index ? 5 : 4}
                fill={lineColor}
                stroke="#F8FAFC"
                strokeWidth="2"
              />
            ))}

            {items.map((item, index) => (
              <text
                key={`label-${item.month}`}
                x={leftPadding + bandWidth * index + bandWidth / 2}
                y={chartHeight - 8}
                textAnchor="middle"
                className="fill-slate-400 text-[12px]"
              >
                {item.monthLabel}
              </text>
            ))}
          </svg>

          {hoveredIndex !== null && items[hoveredIndex] ? (
            <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-lg backdrop-blur">
              <div className="font-semibold">{items[hoveredIndex].monthLabel}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: barColor }} />
                {currentYear}: {items[hoveredIndex].currentYearOrders} orders
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lineColor }} />
                {lastYear}: {items[hoveredIndex].lastYearOrders} orders
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MonthlyRevenueChart({ items, currentYear, lastYear }: { items: MonthlyRevenueItem[]; currentYear: number; lastYear: number }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartWidth = 660;
  const chartHeight = 240;
  const leftPadding = 46;
  const topPadding = 20;
  const bottomPadding = 28;
  const plotHeight = chartHeight - topPadding - bottomPadding;
  const profitColor = "#10B981";
  const subcontractorColor = "#EF4444";
  const lineColor = "#64748B";
  const segmentGap = 2;

  const totals = items.map((item) => Math.max(item.subcontractor, 0) + Math.max(item.profit, 0));
  const lastYearTotals = items.map((item) => Math.max(item.lastYearSubcontractor, 0) + Math.max(item.lastYearProfit, 0));
  const rawMax = [...totals, ...lastYearTotals].reduce((max, value) => Math.max(max, value), 0);
  const niceMax = niceCeil(rawMax);
  const bandWidth = (chartWidth - leftPadding) / Math.max(items.length, 1);
  const barWidth = Math.min(28, bandWidth * 0.5);

  const valueToHeight = (value: number) => (value / niceMax) * plotHeight;
  const valueToY = (value: number) => chartHeight - bottomPadding - valueToHeight(value);

  const linePoints = items.map((item, index) => ({
    x: leftPadding + bandWidth * index + bandWidth / 2,
    y: valueToY(lastYearTotals[index]),
  }));
  const polylinePoints = linePoints.map((point) => `${point.x},${point.y}`).join(" ");

  const totalProfit = items.reduce((sum, item) => sum + item.profit, 0);
  const totalLastYearProfit = items.reduce((sum, item) => sum + item.lastYearProfit, 0);
  const delta = totalProfit - totalLastYearProfit;
  const deltaPercent = totalLastYearProfit > 0 ? (delta / totalLastYearProfit) * 100 : null;
  const yTicks = [0, niceMax / 2, niceMax];

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-logoblue">Revenue</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: profitColor }} />
            {formatNOK(totalProfit)} profit
          </span>
          {deltaPercent !== null ? (
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
            >
              {delta >= 0 ? "+" : ""}
              {deltaPercent.toFixed(0)}% vs last year
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-5 text-xs font-medium text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: profitColor }} />
            Profit
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: subcontractorColor }} />
            Subcontractor
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: lineColor }} />
            {lastYear} revenue
          </span>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-50 p-3" onMouseLeave={() => setHoveredIndex(null)}>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="h-64 w-full"
            preserveAspectRatio="none"
            aria-label="Monthly revenue breakdown compared to last year"
          >
            {yTicks.map((tick) => (
              <g key={`tick-${tick}`}>
                <line x1={leftPadding} y1={valueToY(tick)} x2={chartWidth} y2={valueToY(tick)} stroke="#E1E0D9" strokeWidth="1" />
                <text x={leftPadding - 6} y={valueToY(tick)} dy={tick === 0 ? -2 : 4} textAnchor="end" className="fill-slate-400 text-[10px]">
                  {formatNOK(Math.round(tick))}
                </text>
              </g>
            ))}

            {items.map((item, index) => {
              const x = leftPadding + bandWidth * index + (bandWidth - barWidth) / 2;
              const isHovered = hoveredIndex === index;

              const subcontractorValue = Math.max(item.subcontractor, 0);
              const profitValue = Math.max(item.profit, 0);

              const subcontractorHeight = valueToHeight(subcontractorValue);
              const profitHeight = valueToHeight(profitValue);

              const baseY = chartHeight - bottomPadding;
              const subcontractorY = baseY - subcontractorHeight;
              const profitY = subcontractorY - profitHeight;

              return (
                <g key={`bar-${item.month}`}>
                  {subcontractorHeight > 0 ? (
                    <rect
                      x={x}
                      y={subcontractorY}
                      width={barWidth}
                      height={Math.max(subcontractorHeight - (profitHeight > 0 ? segmentGap : 0), 0)}
                      rx={3}
                      fill={subcontractorColor}
                      opacity={isHovered ? 1 : 0.9}
                    />
                  ) : null}
                  {profitHeight > 0 ? (
                    <rect x={x} y={profitY} width={barWidth} height={profitHeight} rx={3} fill={profitColor} opacity={isHovered ? 1 : 0.9} />
                  ) : null}

                  <rect
                    x={leftPadding + bandWidth * index}
                    y={topPadding}
                    width={bandWidth}
                    height={plotHeight}
                    fill="transparent"
                    onMouseEnter={() => setHoveredIndex(index)}
                  />
                </g>
              );
            })}

            <polyline fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={polylinePoints} />

            {linePoints.map((point, index) => (
              <circle
                key={`dot-${items[index]?.month ?? index}`}
                cx={point.x}
                cy={point.y}
                r={hoveredIndex === index ? 5 : 4}
                fill={lineColor}
                stroke="#F8FAFC"
                strokeWidth="2"
              />
            ))}

            {items.map((item, index) => (
              <text
                key={`label-${item.month}`}
                x={leftPadding + bandWidth * index + bandWidth / 2}
                y={chartHeight - 8}
                textAnchor="middle"
                className="fill-slate-400 text-[12px]"
              >
                {item.monthLabel}
              </text>
            ))}
          </svg>

          {hoveredIndex !== null && items[hoveredIndex] ? (
            <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-lg backdrop-blur">
              <div className="font-semibold">
                {items[hoveredIndex].monthLabel} {currentYear}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: profitColor }} />
                Profit: {formatNOK(items[hoveredIndex].profit)}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: subcontractorColor }} />
                Subcontractor: {formatNOK(items[hoveredIndex].subcontractor)}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lineColor }} />
                {lastYear}: {formatNOK(lastYearTotals[hoveredIndex])}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [onlineMembers, setOnlineMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlineError, setOnlineError] = useState("");
  const [finishingMonth, setFinishingMonth] = useState(false);
  const [finishMonthMessage, setFinishMonthMessage] = useState("");
  const [finishMonthError, setFinishMonthError] = useState("");
  const [updatingOrderEmails, setUpdatingOrderEmails] = useState(false);
  const [orderEmailsEnabled, setOrderEmailsEnabled] = useState(true);
  const [orderEmailsMessage, setOrderEmailsMessage] = useState("");
  const [orderEmailsError, setOrderEmailsError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/dashboard/home", {
          credentials: "include",
          cache: "no-store",
        });

        const json: DashboardResponse | null = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(json?.reason || "Failed to load dashboard");
          return;
        }

        setData(json);
        setOrderEmailsEnabled(json.orderEmailsEnabled);
      } catch {
        setError("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadOnlineMembers() {
      try {
        const res = await fetch("/api/auth/memberships", {
          credentials: "include",
          cache: "no-store",
        });

        const json: MembershipsResponse | null = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          if (isActive) {
            setOnlineError(json?.reason || "Failed to load online members");
          }
          return;
        }

        if (!isActive) {
          return;
        }

        setOnlineError("");
        setOnlineMembers(
          json.memberships
            .filter((member) => member.isOnline && member.status === "ACTIVE")
            .toSorted((a, b) => getOnlineMemberLabel(a).localeCompare(getOnlineMemberLabel(b))),
        );
      } catch {
        if (isActive) {
          setOnlineError("Failed to load online members");
        }
      }
    }

    const refreshOnlineMembers = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void loadOnlineMembers();
    };

    void loadOnlineMembers();

    const intervalId = window.setInterval(refreshOnlineMembers, 30_000);
    document.addEventListener("visibilitychange", refreshOnlineMembers);
    window.addEventListener("focus", refreshOnlineMembers);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshOnlineMembers);
      window.removeEventListener("focus", refreshOnlineMembers);
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading dashboard...</div>;
  }

  if (error || !data) {
    return <div className="p-6 text-sm text-red-400">{error || "No data"}</div>;
  }

  const { stats } = data;
  const bookingEmailCount = stats.bookingEmailCount;
  const monthlyRevenue = data.monthlyRevenue;
  const monthlyComparison = data.monthlyComparison;

  async function handleFinishMonth() {
    try {
      setFinishingMonth(true);
      setFinishMonthError("");
      setFinishMonthMessage("");

      const res = await fetch("/api/dashboard/home/finish-month", {
        method: "POST",
        credentials: "include",
      });
      const json: FinishMonthResponse | null = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setFinishMonthError(json?.message || json?.reason || "Failed to finish month");
        return;
      }

      setFinishMonthMessage(json.message || "Month summaries sent.");
    } catch {
      setFinishMonthError("Failed to finish month");
    } finally {
      setFinishingMonth(false);
    }
  }

  async function handleToggleOrderEmails() {
    const nextValue = !orderEmailsEnabled;

    try {
      setUpdatingOrderEmails(true);
      setOrderEmailsError("");
      setOrderEmailsMessage("");

      const res = await fetch("/api/dashboard/home", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderEmailsEnabled: nextValue,
        }),
      });

      const json: OrderEmailSettingResponse | null = await res.json().catch(() => null);

      if (!res.ok || !json?.ok || typeof json.orderEmailsEnabled !== "boolean") {
        setOrderEmailsError(json?.reason || "Failed to update order email setting");
        return;
      }

      setOrderEmailsEnabled(json.orderEmailsEnabled);
      setOrderEmailsMessage(json.orderEmailsEnabled ? "Order emails are enabled." : "Order emails are disabled.");
    } catch {
      setOrderEmailsError("Failed to update order email setting");
    } finally {
      setUpdatingOrderEmails(false);
    }
  }

  const statTiles: Array<{
    label: string;
    value: string;
    dotClassName: string;
  }> = [
    {
      label: "Orders this month",
      value: stats.ordersThisMonth.toLocaleString("nb-NO"),
      dotClassName: "bg-blue-500",
    },
    {
      label: "Pending",
      value: stats.pendingOrders.toLocaleString("nb-NO"),
      dotClassName: "bg-amber-500",
    },
    {
      label: "Confirmed",
      value: stats.confirmedOrders.toLocaleString("nb-NO"),
      dotClassName: "bg-cyan-500",
    },
    {
      label: "Completed",
      value: stats.completedOrders.toLocaleString("nb-NO"),
      dotClassName: "bg-emerald-500",
    },
    {
      label: "Cancelled",
      value: stats.cancelledOrders.toLocaleString("nb-NO"),
      dotClassName: "bg-orange-500",
    },
    {
      label: "Active",
      value: stats.activeOrders.toLocaleString("nb-NO"),
      dotClassName: "bg-purple-500",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {statTiles.map((tile) => (
            <div key={tile.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className={`h-2 w-2 rounded-full ${tile.dotClassName}`} />
                {tile.label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{tile.value}</div>
            </div>
          ))}
        </section>
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <MonthlyOrdersComparisonChart items={monthlyComparison} currentYear={data.currentYear} lastYear={data.lastYear} />

          <MonthlyRevenueChart items={monthlyRevenue} currentYear={data.currentYear} lastYear={data.lastYear} />
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Online members */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">People Online</h2>
                <p className="mt-0.5 text-sm text-slate-500">Members currently active in the dashboard</p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {onlineMembers.length} online
              </div>
            </div>

            <div className="p-6">
              {onlineError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{onlineError}</div>
              ) : onlineMembers.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No one is online right now.</div>
              ) : (
                <div className="grid gap-3">
                  {onlineMembers.map((member) => {
                    const primaryLabel = getOnlineMemberLabel(member);
                    const hasDisplayName = Boolean(member.user.username?.trim());
                    const secondaryLabel =
                      hasDisplayName && member.user.username !== member.user.email ? member.user.email : member.user.description?.trim() || member.role;

                    return (
                      <div
                        key={member.id}
                        className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/60"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-logoblue to-blue-500 text-sm font-bold text-white shadow-md">
                            {primaryLabel?.charAt(0)?.toUpperCase() || "U"}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-slate-800">{primaryLabel}</div>
                            <div className="truncate text-sm text-slate-500">{secondaryLabel}</div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            Online
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Booking Emails</h2>
                <p className="mt-0.5 text-sm text-slate-500">New emails related to booking orders</p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                {bookingEmailCount} new
              </div>
            </div>

            <div className="p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-base font-semibold text-slate-800">Unread booking emails</div>
                    <div className="mt-1 text-sm text-slate-500">Customer replies waiting for admin follow-up</div>
                  </div>

                  <div className="inline-flex min-w-[120] items-center justify-center rounded-2xl bg-white px-6 py-4 text-3xl font-bold text-slate-900 shadow-sm">
                    {bookingEmailCount}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <GdprSection />

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Quick Tasks</h2>
            <p className="mt-0.5 text-sm text-slate-500">Shortcuts for manual dashboard jobs</p>
          </div>

          <div className="p-6">
            {/* <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-800">
                    Finish month
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Sends one Excel summary per partner for this month.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFinishMonth}
                  disabled={finishingMonth}
                  className="inline-flex min-w-[180] items-center justify-center rounded-2xl bg-logoblue px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {finishingMonth ? "Sending..." : "Finish month"}
                </button>
              </div>

              {finishMonthMessage ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {finishMonthMessage}
                </div>
              ) : null}

              {finishMonthError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {finishMonthError}
                </div>
              ) : null}
            </div> */}

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-800">Order emails</div>
                  <div className="mt-1 text-sm text-slate-500">Disable outbound order emails while import and pricing work is in progress.</div>
                  <div className="mt-2 text-sm font-medium text-slate-700">Current status: {orderEmailsEnabled ? "Enabled" : "Disabled"}</div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleOrderEmails}
                  disabled={updatingOrderEmails}
                  className={`inline-flex min-w-[180] items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 ${
                    orderEmailsEnabled ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {updatingOrderEmails ? "Saving..." : orderEmailsEnabled ? "Disable emails" : "Enable emails"}
                </button>
              </div>

              {orderEmailsMessage ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{orderEmailsMessage}</div>
              ) : null}

              {orderEmailsError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{orderEmailsError}</div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
