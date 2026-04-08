"use client";

import { useEffect, useState } from "react";

type DashboardStats = {
  totalIncome: number;
  ordersThisMonth: number;
  completedOrders: number;
  activeOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
};

type StatusItem = {
  status: string;
  count: number;
};

type DashboardResponse = {
  ok: boolean;
  stats: DashboardStats;
  statusBreakdown: StatusItem[];
  reason?: string;
};

function formatNOK(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(value);
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-logoblue p-5 shadow-lg">
      <h3 className="text-sm text-white">{title}</h3>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
      <div className="mt-4 flex gap-2">

      </div>
    </div>
  );
}

export default function DashboardHome() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/dashboard/home", {
          credentials: "include",
          cache: "no-store",
        });

        const json = await res.json();
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

    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-400">Loading dashboard...</div>
    );
  }

  if (error || !data) {
    return <div className="p-6 text-sm text-red-400">{error || "No data"}</div>;
  }

  const { stats,} = data;

  return (
    <div className="min-h-screen p-6 text-logoblue">
      <h1 className="mb-6 text-3xl font-bold">Booking System Dashboard</h1>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Total Income This Month"
          value={formatNOK(stats.totalIncome)}
        />
        <StatCard title="Orders This Month" value={stats.ordersThisMonth} />
        <StatCard title="Completed Orders" value={stats.completedOrders} />
        <StatCard title="Active Orders" value={stats.activeOrders} />
        <StatCard title="Pending Orders" value={stats.pendingOrders} />
        <StatCard title="Cancelled Orders" value={stats.cancelledOrders} />
      </div>
    </div>
  );
}
