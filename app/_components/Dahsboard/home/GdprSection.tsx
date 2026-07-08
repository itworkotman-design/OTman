"use client";

import { useEffect, useState } from "react";
import { GDPR_EVENT_LABELS, formatGdprEventDetail } from "@/lib/gdpr/auditEvents";

type InvoicedOrder = {
  id: string;
  displayId: number;
  deliveryDate: string | null;
  status: string | null;
  invoicedAt: string | null;
  gdprHold: boolean;
};

type InvoicedWarningResponse = {
  ok: boolean;
  orders: InvoicedOrder[];
  reason?: string;
};

type HeldOrder = {
  id: string;
  displayId: number;
  status: string | null;
  deliveryDate: string | null;
  gdprHoldReason: string | null;
  gdprHoldSetAt: string | null;
};

type HeldOrdersResponse = {
  ok: boolean;
  orders: HeldOrder[];
  reason?: string;
};

type BulkUpdateResponse = {
  ok: boolean;
  updatedCount?: number;
  skippedHeldCount?: number;
  reason?: string;
};

type HoldResponse = {
  ok: boolean;
  heldCount?: number;
  removedCount?: number;
  reason?: string;
};

type GdprAuditEvent = {
  id: string;
  type: string;
  createdAt: string;
  orderDisplayId: number;
  actor: string;
  payload: unknown;
};

type AuditLogResponse = {
  ok: boolean;
  events: GdprAuditEvent[];
  reason?: string;
};

async function loadInvoicedWarning(): Promise<InvoicedWarningResponse | null> {
  const res = await fetch("/api/dashboard/gdpr/invoiced-warning", {
    credentials: "include",
    cache: "no-store",
  });

  return res.json().catch(() => null);
}

async function loadHeldOrders(): Promise<HeldOrdersResponse | null> {
  const res = await fetch("/api/dashboard/gdpr/held-orders", {
    credentials: "include",
    cache: "no-store",
  });

  return res.json().catch(() => null);
}

function buildAuditLogQuery(from: string, to: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function toggleId(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

function toggleSelectAll(allIds: string[], current: Set<string>): Set<string> {
  return current.size === allIds.length && allIds.length > 0 ? new Set() : new Set(allIds);
}

export default function GdprSection() {
  // Invoiced-orders warning
  const [invoicedOrders, setInvoicedOrders] = useState<InvoicedOrder[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [invoicedLoading, setInvoicedLoading] = useState(true);
  const [invoicedError, setInvoicedError] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  // Orders currently on GDPR hold (any status)
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [heldSelectedIds, setHeldSelectedIds] = useState<Set<string>>(new Set());
  const [heldLoading, setHeldLoading] = useState(true);
  const [heldError, setHeldError] = useState("");
  const [heldSubmitting, setHeldSubmitting] = useState(false);
  const [heldMessage, setHeldMessage] = useState("");
  const [heldActionError, setHeldActionError] = useState("");

  // Audit log dropdown
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEvents, setAuditEvents] = useState<GdprAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function refreshInvoiced() {
    setInvoicedLoading(true);
    const json = await loadInvoicedWarning();

    if (!json?.ok) {
      setInvoicedError(json?.reason || "Failed to load invoiced orders");
      setInvoicedLoading(false);
      return;
    }

    setInvoicedError("");
    setInvoicedOrders(json.orders);
    setSelectedIds(new Set());
    setInvoicedLoading(false);
  }

  async function refreshHeld() {
    setHeldLoading(true);
    const json = await loadHeldOrders();

    if (!json?.ok) {
      setHeldError(json?.reason || "Failed to load held orders");
      setHeldLoading(false);
      return;
    }

    setHeldError("");
    setHeldOrders(json.orders);
    setHeldSelectedIds(new Set());
    setHeldLoading(false);
  }

  async function loadAuditLog() {
    setAuditLoading(true);
    setAuditError("");

    try {
      const res = await fetch(`/api/dashboard/gdpr/audit-log${buildAuditLogQuery(fromDate, toDate)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json: AuditLogResponse | null = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setAuditError(json?.reason || "Failed to load GDPR audit log");
        return;
      }

      setAuditEvents(json.events);
    } catch {
      setAuditError("Failed to load GDPR audit log");
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    void refreshInvoiced();
    void refreshHeld();
  }, []);

  useEffect(() => {
    if (auditOpen) {
      void loadAuditLog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditOpen]);

  async function handleUpdateToPaid() {
    setSubmitting(true);
    setMessage("");
    setActionError("");

    try {
      const res = await fetch("/api/orders/bulk", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [...selectedIds], status: "paid" }),
      });
      const json: BulkUpdateResponse | null = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setActionError(json?.reason || "Failed to update selected orders");
        return;
      }

      const skipped = json.skippedHeldCount ?? 0;
      setMessage(
        `Updated ${json.updatedCount ?? 0} order(s) to Betalt.` +
          (skipped > 0 ? ` ${skipped} on-hold order(s) were skipped.` : ""),
      );
      await refreshInvoiced();
      await refreshHeld();
    } catch {
      setActionError("Failed to update selected orders");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetHold() {
    if (!holdReason.trim()) {
      setActionError("A reason is required to place a GDPR hold.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setActionError("");

    try {
      const res = await fetch("/api/orders/gdpr/hold", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [...selectedIds], reason: holdReason.trim() }),
      });
      const json: HoldResponse | null = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setActionError(json?.reason || "Failed to place hold");
        return;
      }

      setMessage(`Placed GDPR hold on ${json.heldCount ?? 0} order(s).`);
      setHoldReason("");
      await refreshInvoiced();
      await refreshHeld();
    } catch {
      setActionError("Failed to place hold");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveHoldFromInvoiced() {
    setSubmitting(true);
    setMessage("");
    setActionError("");

    try {
      const res = await fetch("/api/orders/gdpr/hold", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [...selectedIds] }),
      });
      const json: HoldResponse | null = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setActionError(json?.reason || "Failed to remove hold");
        return;
      }

      setMessage(`Removed GDPR hold from ${json.removedCount ?? 0} order(s).`);
      await refreshInvoiced();
      await refreshHeld();
    } catch {
      setActionError("Failed to remove hold");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveHoldFromHeld() {
    setHeldSubmitting(true);
    setHeldMessage("");
    setHeldActionError("");

    try {
      const res = await fetch("/api/orders/gdpr/hold", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [...heldSelectedIds] }),
      });
      const json: HoldResponse | null = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setHeldActionError(json?.reason || "Failed to remove hold");
        return;
      }

      setHeldMessage(`Removed GDPR hold from ${json.removedCount ?? 0} order(s).`);
      await refreshHeld();
      await refreshInvoiced();
    } catch {
      setHeldActionError("Failed to remove hold");
    } finally {
      setHeldSubmitting(false);
    }
  }

  const pdfHref = `/api/dashboard/gdpr/audit-log/pdf${buildAuditLogQuery(fromDate, toDate)}`;
  const invoicedIds = invoicedOrders.map((order) => order.id);
  const heldIds = heldOrders.map((order) => order.id);

  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
      <div className="bg-linear-to-r from-logoblue to-blue-500 px-6 py-5">
        <h2 className="text-xl font-semibold text-white">GDPR</h2>
        <p className="mt-1 text-sm text-white/75">
          Invoiced orders awaiting payment, orders on hold, and the anonymization/POD/hold audit log
        </p>
      </div>

      <div className="p-6">
        {/* Invoiced orders awaiting payment */}
        {invoicedLoading ? (
          <div className="text-sm text-slate-400">Loading...</div>
        ) : invoicedError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {invoicedError}
          </div>
        ) : invoicedOrders.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No invoiced orders have been waiting on payment for more than 2 months.
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="mb-3 text-sm font-semibold text-amber-800">
              Invoiced orders awaiting payment (Fakturert &gt; 2 months)
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="w-10 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === invoicedIds.length && invoicedIds.length > 0}
                        onChange={() => setSelectedIds((current) => toggleSelectAll(invoicedIds, current))}
                        aria-label="Select all invoiced orders"
                      />
                    </th>
                    <th className="py-2 font-semibold">Order</th>
                    <th className="py-2 font-semibold">Delivery date</th>
                    <th className="py-2 font-semibold">Status</th>
                    <th className="py-2 font-semibold">On hold</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicedOrders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100">
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => setSelectedIds((current) => toggleId(current, order.id))}
                        />
                      </td>
                      <td className="py-2 font-medium text-slate-800">#{order.displayId}</td>
                      <td className="py-2 text-slate-600">{order.deliveryDate ?? "-"}</td>
                      <td className="py-2 text-slate-600">{order.status ?? "-"}</td>
                      <td className="py-2">
                        {order.gdprHold ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                            On hold
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-amber-200 pt-5 md:flex-row md:items-center md:justify-between">
              <input
                type="text"
                value={holdReason}
                onChange={(event) => setHoldReason(event.target.value)}
                placeholder="Reason for GDPR hold (required to place a hold)"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:max-w-sm"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleUpdateToPaid}
                  disabled={submitting || selectedIds.size === 0}
                  className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Update selected to Betalt
                </button>
                <button
                  type="button"
                  onClick={handleSetHold}
                  disabled={submitting || selectedIds.size === 0}
                  className="rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Put selected on hold
                </button>
                <button
                  type="button"
                  onClick={handleRemoveHoldFromInvoiced}
                  disabled={submitting || selectedIds.size === 0}
                  className="rounded-2xl bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Remove hold
                </button>
              </div>
            </div>

            {message ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}

            {actionError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            ) : null}
          </div>
        )}

        {/* Orders currently on GDPR hold, regardless of status */}
        {heldLoading ? null : heldError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {heldError}
          </div>
        ) : heldOrders.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-300 bg-slate-50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-700">
              Orders on GDPR hold — automatic anonymization/POD cleanup is paused
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="w-10 py-2">
                      <input
                        type="checkbox"
                        checked={heldSelectedIds.size === heldIds.length && heldIds.length > 0}
                        onChange={() => setHeldSelectedIds((current) => toggleSelectAll(heldIds, current))}
                        aria-label="Select all held orders"
                      />
                    </th>
                    <th className="py-2 font-semibold">Order</th>
                    <th className="py-2 font-semibold">Status</th>
                    <th className="py-2 font-semibold">Delivery date</th>
                    <th className="py-2 font-semibold">Hold reason</th>
                    <th className="py-2 font-semibold">On hold since</th>
                  </tr>
                </thead>
                <tbody>
                  {heldOrders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100">
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={heldSelectedIds.has(order.id)}
                          onChange={() => setHeldSelectedIds((current) => toggleId(current, order.id))}
                        />
                      </td>
                      <td className="py-2 font-medium text-slate-800">#{order.displayId}</td>
                      <td className="py-2 text-slate-600">{order.status ?? "-"}</td>
                      <td className="py-2 text-slate-600">{order.deliveryDate ?? "-"}</td>
                      <td className="py-2 text-slate-600">{order.gdprHoldReason ?? "-"}</td>
                      <td className="py-2 text-slate-500">
                        {order.gdprHoldSetAt ? new Date(order.gdprHoldSetAt).toLocaleDateString("nb-NO") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex justify-end border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={handleRemoveHoldFromHeld}
                disabled={heldSubmitting || heldSelectedIds.size === 0}
                className="rounded-2xl bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Remove hold from selected
              </button>
            </div>

            {heldMessage ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {heldMessage}
              </div>
            ) : null}

            {heldActionError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {heldActionError}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Audit log dropdown */}
        <details
          className="mt-6 overflow-hidden rounded-2xl border border-slate-200"
          open={auditOpen}
          onToggle={(event) => setAuditOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer list-none bg-slate-100 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-700">GDPR audit log</span>
              <span className="text-xs font-medium text-slate-500">{auditOpen ? "Hide" : "Show"}</span>
            </div>
          </summary>

          <div className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-slate-500">
                  From
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  To
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void loadAuditLog()}
                  className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Apply
                </button>
              </div>

              <a
                href={pdfHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-logoblue px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Download PDF
              </a>
            </div>

            <div className="mt-4">
              {auditLoading ? (
                <div className="text-sm text-slate-400">Loading...</div>
              ) : auditError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {auditError}
                </div>
              ) : auditEvents.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No GDPR actions recorded in this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 font-semibold">Order</th>
                        <th className="py-2 font-semibold">Event</th>
                        <th className="py-2 font-semibold">Detail</th>
                        <th className="py-2 font-semibold">Actor</th>
                        <th className="py-2 font-semibold">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditEvents.map((event) => (
                        <tr key={event.id} className="border-b border-slate-100">
                          <td className="py-2 font-medium text-slate-800">#{event.orderDisplayId}</td>
                          <td className="py-2 text-slate-600">{GDPR_EVENT_LABELS[event.type] ?? event.type}</td>
                          <td className="py-2 text-slate-500">{formatGdprEventDetail(event.type, event.payload)}</td>
                          <td className="py-2 text-slate-600">{event.actor}</td>
                          <td className="py-2 text-slate-500">
                            {new Date(event.createdAt).toLocaleString("nb-NO")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
