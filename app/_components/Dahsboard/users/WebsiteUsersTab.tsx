"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getOrderStatusStyle } from "@/lib/orders/statusPresentation";

// User management → "Website users": the temporary "My order" logins of the
// company's homepage customers (GET/PATCH/DELETE /api/auth/customer-accounts).
// Only user-management admins see this tab; the API checks it again.

type WebsiteUser = {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  activeSessions: number;
  deleteAt: string | null;
  sharedWithOtherCompany: boolean;
  orders: { id: string; orderNumber: string | null; displayId: number | null; status: string | null; deliveryDate: string | null }[];
};

const REASONS: Record<string, string> = {
  PASSWORD_TOO_SHORT: "The password needs at least 8 characters.",
  INVALID_EMAIL: "That isn't a valid email address.",
  EMAIL_TAKEN: "Another website login already uses that email.",
  EMAIL_FAILED: "The password was changed, but the email could not be sent. Try again, or give the customer the password another way.",
  SHARED_ACCOUNT: "This login also has another company's orders, so it can't be changed here.",
  NOT_FOUND: "This login no longer exists.",
  FORBIDDEN: "You don't have access to manage website users.",
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Oslo" });
}

const cell = "border-r border-black/3 px-4 py-2 text-textColorThird";
const head = "whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium";

export function WebsiteUsersTab() {
  const [users, setUsers] = useState<WebsiteUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError("");
      const res = await fetch("/api/auth/customer-accounts", { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(REASONS[data?.reason] ?? "Failed to load website users");
        return;
      }
      setUsers(data.accounts);
    } catch {
      setError("Failed to load website users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (user) => user.email.includes(q) || user.orders.some((order) => (order.orderNumber ?? String(order.displayId ?? "")).toLowerCase().includes(q)),
    );
  }, [users, query]);

  const selected = users.find((user) => user.id === selectedId) ?? null;

  return (
    <div className="min-w-0">
      <p className="mb-6 max-w-3xl text-sm text-textColorThird">
        Temporary logins homepage customers get with their order, for &quot;My order&quot; on the website. They never give access to the
        dashboard, and are deleted automatically a day after all of the customer&apos;s orders are closed.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search email or order number"
          className="h-10 w-full max-w-sm rounded-lg border border-black/15 px-3 text-sm focus:border-logoblue focus:outline-none"
        />
        <span className="text-sm text-textColorThird">
          {filtered.length} of {users.length} logins
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-textColorThird">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-textColorThird">{users.length === 0 ? "No website logins right now." : "No logins match the search."}</p>
      ) : (
        <div className="overflow-x-auto rounded-[20px] border border-black/8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/8 bg-black/3 text-left text-textColorSecond">
                <th className={head}>Email</th>
                <th className={head}>Orders</th>
                <th className={head}>Created</th>
                <th className={head}>Last login</th>
                <th className={head}>Signed in</th>
                <th className={head}>Deleted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-b border-black/10 transition-colors hover:bg-black/2">
                  <td className={`${cell} font-semibold text-textColorSecond`}>
                    {user.email}
                    {user.sharedWithOtherCompany && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Shared</span>
                    )}
                  </td>
                  <td className={cell}>
                    <div className="flex flex-wrap gap-1.5">
                      {user.orders.map((order) => (
                        <span
                          key={order.id}
                          style={getOrderStatusStyle(order.status)}
                          className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold"
                          title={order.deliveryDate ? `Delivery ${order.deliveryDate}` : undefined}
                        >
                          #{order.orderNumber ?? order.displayId} · {order.status ?? "—"}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={`${cell} whitespace-nowrap`}>{formatDateTime(user.createdAt)}</td>
                  <td className={`${cell} whitespace-nowrap`}>{formatDateTime(user.lastLoginAt)}</td>
                  <td className={cell}>{user.activeSessions > 0 ? `${user.activeSessions} device${user.activeSessions === 1 ? "" : "s"}` : "—"}</td>
                  <td className={`${cell} whitespace-nowrap`}>{user.deleteAt ? formatDateTime(user.deleteAt) : "While an order is open"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedId(user.id)}
                      className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-semibold text-logoblue hover:border-logoblue"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ManageWebsiteUser
          key={selected.id}
          user={selected}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          onDeleted={() => {
            setSelectedId(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ManageWebsiteUser({
  user,
  onClose,
  onChanged,
  onDeleted,
}: {
  user: WebsiteUser;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onDeleted: () => void;
}) {
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const locked = user.sharedWithOtherCompany;

  async function run(action: string, request: () => Promise<Response>, success: string, after?: () => void) {
    setBusy(action);
    setMessage(null);
    try {
      const res = await request();
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setMessage({ ok: false, text: REASONS[data?.reason] ?? "Something went wrong." });
        return;
      }
      setMessage({ ok: true, text: success });
      after?.();
      await onChanged();
    } catch {
      setMessage({ ok: false, text: "Something went wrong." });
    } finally {
      setBusy(null);
    }
  }

  const patch = (body: Record<string, unknown>) => () =>
    fetch(`/api/auth/customer-accounts/${user.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const section = "border-t border-black/8 pt-5";
  const input = "h-10 w-full rounded-lg border border-black/15 px-3 text-sm focus:border-logoblue focus:outline-none disabled:bg-black/3";
  const button =
    "h-10 shrink-0 rounded-lg bg-logoblue px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-textColorThird">Website user</p>
            <h2 className="truncate text-lg font-semibold text-logoblue">{user.email}</h2>
            <p className="text-sm text-textColorThird">
              {user.orders.length} order{user.orders.length === 1 ? "" : "s"} · last login {formatDateTime(user.lastLoginAt)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-textColorThird hover:text-textColorSecond" aria-label="Close">
            ×
          </button>
        </div>

        {locked && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{REASONS.SHARED_ACCOUNT}</p>}
        {message && (
          <p className={`rounded-lg px-4 py-3 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>
        )}

        <div className={section}>
          <h3 className="font-semibold text-textColorSecond">Email</h3>
          <p className="mb-3 text-sm text-textColorThird">The customer logs in with it. The customer&apos;s orders here get the new email too.</p>
          <div className="flex gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={locked} className={input} />
            <button
              type="button"
              disabled={locked || busy !== null || email.trim().toLowerCase() === user.email}
              onClick={() => run("email", patch({ action: "changeEmail", email }), "Email changed.")}
              className={button}
            >
              {busy === "email" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className={section}>
          <h3 className="font-semibold text-textColorSecond">Password</h3>
          <p className="mb-3 text-sm text-textColorThird">
            Email the customer a new generated password, or set one yourself (it is not emailed). Either signs them out everywhere.
          </p>
          <button
            type="button"
            disabled={locked || busy !== null}
            onClick={() => run("send", patch({ action: "sendNewPassword" }), `A new password was emailed to ${user.email}.`)}
            className={`${button} mb-3 w-full`}
          >
            {busy === "send" ? "Sending…" : "Email a new password"}
          </button>
          <div className="flex gap-2">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min. 8 characters)"
              autoComplete="new-password"
              disabled={locked}
              className={input}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="h-10 shrink-0 rounded-lg border border-black/15 px-3 text-sm text-textColorSecond"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              disabled={locked || busy !== null || password.length < 8}
              onClick={() => run("password", patch({ action: "setPassword", password }), "Password set.", () => setPassword(""))}
              className={button}
            >
              {busy === "password" ? "Saving…" : "Set"}
            </button>
          </div>
        </div>

        <div className={section}>
          <h3 className="font-semibold text-textColorSecond">Sessions</h3>
          <p className="mb-3 text-sm text-textColorThird">
            Signed in on {user.activeSessions} device{user.activeSessions === 1 ? "" : "s"}.
          </p>
          <button
            type="button"
            disabled={locked || busy !== null || user.activeSessions === 0}
            onClick={() => run("signout", patch({ action: "signOut" }), "Signed out everywhere.")}
            className="h-10 rounded-lg border border-black/15 px-4 text-sm font-semibold text-textColorSecond hover:border-logoblue disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "signout" ? "Signing out…" : "Sign out everywhere"}
          </button>
        </div>

        <div className={section}>
          <h3 className="font-semibold text-red-700">Delete login</h3>
          <p className="mb-3 text-sm text-textColorThird">
            Removes the customer&apos;s access to My order. The orders themselves stay. &quot;Send new login&quot; on an order creates a new one.
          </p>
          {confirmDelete ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  run(
                    "delete",
                    () => fetch(`/api/auth/customer-accounts/${user.id}`, { method: "DELETE", credentials: "include" }),
                    "Login deleted.",
                    onDeleted,
                  )
                }
                className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "delete" ? "Deleting…" : "Yes, delete the login"}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-10 px-3 text-sm font-semibold text-textColorSecond">
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={locked || busy !== null}
              onClick={() => setConfirmDelete(true)}
              className="h-10 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete login
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
