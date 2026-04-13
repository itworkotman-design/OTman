"use client";

import { useEffect, useState } from "react";
import type { Membership } from "@/lib/users/types";

type DashboardStats = {
  totalIncome: number;
  ordersThisMonth: number;
  completedOrders: number;
  activeOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  bookingEmailCount: number;
};

type StatusItem = {
  status: string;
  count: number;
};

type DashboardResponse = {
  ok: boolean;
  stats: DashboardStats;
  statusBreakdown: StatusItem[];
  dailyActivity: DailyActivityItem[];
  reason?: string;
};

type DailyActivityItem = {
  date: string;
  orders: number;
  revenue: number;
};

type MembershipsResponse = {
  ok: boolean;
  memberships: Membership[];
  reason?: string;
};

const STATUS_BAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
];

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

function formatStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase();

  switch (normalized) {
    case "behandles":
      return "Pending";
    case "bekreftet":
      return "Confirmed";
    case "aktiv":
      return "Active";
    case "kanselert":
      return "Cancelled";
    case "ferdig":
      return "Completed";
    case "fakturert":
      return "Invoiced";
    case "betalt":
      return "Paid";
    case "fail":
      return "Failed";
    default:
      return status || "Unknown";
  }
}

function StatusBreakdownChart({ items }: { items: StatusItem[] }) {
  const sortedItems = items
    .filter((item) => item.count > 0)
    .toSorted((left, right) => right.count - left.count);
  const maxCount = sortedItems.reduce(
    (currentMax, item) => Math.max(currentMax, item.count),
    0,
  );
  const totalCount = sortedItems.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
      <div className=" bg-linear-to-r from-logoblue to-blue-500 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Order Status Breakdown
            </h2>
            <p className="mt-1 text-sm text-white/75">
              Current distribution of booking order statuses
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
            {totalCount} orders
          </div>
        </div>
      </div>

      <div className="p-6">
        {sortedItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No status data available.
          </div>
        ) : (
          <div className="space-y-4">
            {sortedItems.map((item, index) => {
              const widthPercent =
                maxCount > 0 ? Math.max((item.count / maxCount) * 100, 8) : 0;
              const fillColor =
                STATUS_BAR_COLORS[index % STATUS_BAR_COLORS.length];

              return (
                <div key={item.status} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-800">
                      {formatStatusLabel(item.status)}
                    </div>
                    <div className="text-sm text-slate-500">{item.count}</div>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${fillColor}`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

type SeriesPoint = {
  x: number;
  y: number;
  value: number;
};

function buildSeriesPoints(input: {
  values: number[];
  width: number;
  height: number;
  topPadding: number;
  bottomPadding: number;
}): SeriesPoint[] {
  const { values, width, height, topPadding, bottomPadding } = input;

  if (values.length === 0) {
    return [];
  }

  const maxValue = values.reduce(
    (currentMax, value) => Math.max(currentMax, value),
    0,
  );
  const chartHeight = height - topPadding - bottomPadding;
  const denominator = Math.max(maxValue, 1);

  return values.map((value, index) => {
    const x =
      values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y =
      height - bottomPadding - (value / denominator) * Math.max(chartHeight, 1);

    return {
      x,
      y,
      value,
    };
  });
}

function DailySeriesChart({
  ariaLabel,
  lineColor,
  guideColor,
  items,
  points,
  bottomPadding,
  chartWidth,
  chartHeight,
  formatValue,
}: {
  ariaLabel: string;
  lineColor: string;
  guideColor: string;
  items: DailyActivityItem[];
  points: SeriesPoint[];
  bottomPadding: number;
  chartWidth: number;
  chartHeight: number;
  formatValue: (value: number) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const polylinePoints = points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const labelIndexes = items
    .map((_, index) => index)
    .filter((index) => {
      if (items.length <= 6) {
        return true;
      }

      return (
        index === 0 ||
        index === items.length - 1 ||
        index % Math.ceil(items.length / 6) === 0
      );
    });

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-white p-3 shadow-sm"
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="h-44 w-full"
        preserveAspectRatio="none"
        aria-label={ariaLabel}
      >
        {points.map((point, index) => (
          <line
            key={`guide-${items[index]?.date ?? index}`}
            x1={point.x}
            y1={point.y}
            x2={point.x}
            y2={chartHeight - bottomPadding}
            stroke={guideColor}
            strokeWidth="2"
          />
        ))}
        <polyline
          fill="none"
          stroke={lineColor}
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polylinePoints}
        />
        {points.map((point, index) => (
          <g key={`point-${items[index]?.date ?? index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="14"
              fill="transparent"
              onMouseEnter={() => setHoveredIndex(index)}
            />
          </g>
        ))}
        {labelIndexes.map((index) => {
          const item = items[index];
          if (!item) {
            return null;
          }

          const x =
            items.length === 1
              ? chartWidth / 2
              : (index / (items.length - 1)) * chartWidth;

          return (
            <text
              key={`label-${item.date}`}
              x={x}
              y={chartHeight - 4}
              textAnchor="middle"
              className="fill-slate-400 text-[12px]"
            >
              {item.date.slice(8, 10)}
            </text>
          );
        })}
      </svg>

      {hoveredIndex !== null && items[hoveredIndex] ? (
        <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-lg backdrop-blur">
          <div className="font-semibold">{items[hoveredIndex].date}</div>
          <div>{formatValue(points[hoveredIndex]?.value ?? 0)}</div>
        </div>
      ) : null}
    </div>
  );
}

function DailyActivityChart({ items }: { items: DailyActivityItem[] }) {
  const chartWidth = 720;
  const chartHeight = 180;
  const topPadding = 16;
  const bottomPadding = 26;
  const nonZeroItems = items.filter(
    (item) => item.orders > 0 || item.revenue > 0,
  );
  const chartItems = nonZeroItems.length > 0 ? items : items.slice(-7);
  const ordersValues = chartItems.map((item) => item.orders);
  const revenueValues = chartItems.map((item) => item.revenue);
  const ordersPlotPoints = buildSeriesPoints({
    values: ordersValues,
    width: chartWidth,
    height: chartHeight,
    topPadding,
    bottomPadding,
  });
  const revenuePlotPoints = buildSeriesPoints({
    values: revenueValues,
    width: chartWidth,
    height: chartHeight,
    topPadding,
    bottomPadding,
  });
  const totalOrders = chartItems.reduce((sum, item) => sum + item.orders, 0);
  const totalRevenue = chartItems.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
      <div className=" bg-linear-to-r from-logoblue to-blue-500 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Daily Activity This Month
            </h2>
            <p className="mt-1 text-sm text-white/75">
              Orders and revenue grouped by day for the active company
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-300" />
              {totalOrders} orders
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              {formatNOK(totalRevenue)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800">
              Orders per day
            </div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Blue line
            </div>
          </div>
          <DailySeriesChart
            ariaLabel="Orders per day chart"
            lineColor="#3B82F6"
            guideColor="#DBEAFE"
            items={chartItems}
            points={ordersPlotPoints}
            bottomPadding={bottomPadding}
            chartWidth={chartWidth}
            chartHeight={chartHeight}
            formatValue={(value) => `${value} orders`}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800">
              Revenue per day
            </div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Green line
            </div>
          </div>
          <DailySeriesChart
            ariaLabel="Revenue per day chart"
            lineColor="#10B981"
            guideColor="#D1FAE5"
            items={chartItems}
            points={revenuePlotPoints}
            bottomPadding={bottomPadding}
            chartWidth={chartWidth}
            chartHeight={chartHeight}
            formatValue={(value) => formatNOK(Math.round(value))}
          />
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

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/dashboard/home", {
          credentials: "include",
          cache: "no-store",
        });

        const json: DashboardResponse | null = await res
          .json()
          .catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(json?.reason || "Failed to load dashboard");
          return;
        }

        setData(json);
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

        const json: MembershipsResponse | null = await res
          .json()
          .catch(() => null);

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
            .toSorted((a, b) =>
              getOnlineMemberLabel(a).localeCompare(getOnlineMemberLabel(b)),
            ),
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
    return (
      <div className="p-6 text-sm text-slate-400">Loading dashboard...</div>
    );
  }

  if (error || !data) {
    return <div className="p-6 text-sm text-red-400">{error || "No data"}</div>;
  }

  const { stats } = data;
  const bookingEmailCount = stats.bookingEmailCount;
  const statusBreakdown = data.statusBreakdown;
  const dailyActivity = data.dailyActivity;

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <DailyActivityChart items={dailyActivity} />

        <StatusBreakdownChart items={statusBreakdown} />

        <section className="grid gap-5 lg:grid-cols-2">
          {/* Online members */}
          <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="bg-linear-to-r from-logoblue to-blue-500 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    People Online
                  </h2>
                  <p className="mt-1 text-sm text-white/75">
                    Members currently active in the dashboard
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                  {onlineMembers.length} online
                </div>
              </div>
            </div>

            <div className="p-6">
              {onlineError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {onlineError}
                </div>
              ) : onlineMembers.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No one is online right now.
                </div>
              ) : (
                <div className="grid gap-3">
                  {onlineMembers.map((member) => {
                    const primaryLabel = getOnlineMemberLabel(member);
                    const hasDisplayName = Boolean(
                      member.user.username?.trim(),
                    );
                    const secondaryLabel =
                      hasDisplayName &&
                      member.user.username !== member.user.email
                        ? member.user.email
                        : member.user.description?.trim() || member.role;

                    return (
                      <div
                        key={member.id}
                        className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/60"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-logoblue to-blue-500 text-sm font-bold text-white shadow-md">
                            {primaryLabel?.charAt(0)?.toUpperCase() || "U"}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-slate-800">
                              {primaryLabel}
                            </div>
                            <div className="truncate text-sm text-slate-500">
                              {secondaryLabel}
                            </div>
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

          <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="bg-linear-to-r from-logoblue to-blue-500 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Booking Emails
                  </h2>
                  <p className="mt-1 text-sm text-white/75">
                    New emails related to booking orders
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />
                  {bookingEmailCount} new
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-base font-semibold text-slate-800">
                      Unread booking emails
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Customer replies waiting for admin follow-up
                    </div>
                  </div>

                  <div className="inline-flex min-w-[120px] items-center justify-center rounded-2xl bg-white px-6 py-4 text-3xl font-bold text-slate-900 shadow-sm">
                    {bookingEmailCount}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
