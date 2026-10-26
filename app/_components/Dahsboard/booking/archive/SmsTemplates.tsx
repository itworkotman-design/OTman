"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SmsSegmentInfo } from "@/app/_components/Dahsboard/booking/archive/OrderSmsPanel";
import { sortSmsTemplates } from "@/lib/sms/templates";
import { SmsPlaceholderLegend, type SmsPlaceholder } from "@/app/_components/Dahsboard/booking/archive/SmsPlaceholderLegend";

export type SmsTemplate = {
  id: string;
  kind: "MANUAL" | "DAY_OF_DELIVERY" | "REVIEW_REQUEST";
  name: string;
  // Admin-facing note, stored in the DB; never sent in the SMS.
  description: string | null;
  body: string;
  enabled: boolean;
};

// Re-exported so existing imports from this module keep working.
export { SmsPlaceholderLegend, type SmsPlaceholder };

type TemplatesResponse = {
  ok: boolean;
  reason?: string;
  configured?: boolean;
  templates?: SmsTemplate[];
  placeholders?: SmsPlaceholder[];
};

const inputClass =
  "w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue";

// Shared by the templates modal and the bulk SMS modal.
export function useSmsTemplates(open: boolean) {
  const [data, setData] = useState<TemplatesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sms/templates", { credentials: "include", cache: "no-store" });
      const json = (await response.json().catch(() => null)) as TemplatesResponse | null;
      if (!response.ok || !json?.ok) setError(json?.reason || "Failed to load SMS templates");
      else setData(json);
    } catch {
      setError("Failed to load SMS templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return { data, loading, error, reload: load };
}

export function SmsModalShell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center px-4 py-6">
        <div className="flex max-h-[94vh] w-full max-w-[860px] flex-col customContainer bg-white" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
            <div>
              <h2 className="text-2xl font-semibold text-logoblue">{title}</h2>
              {subtitle ? <p className="mt-1 text-sm text-textColorThird">{subtitle}</p> : null}
            </div>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-logoblue text-white" aria-label="Close">
              X
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 px-6 py-5">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// `expanded` lives in the parent: editors are keyed on saved content, so they
// remount after a save and would otherwise snap shut.
function TemplateEditor({
  template,
  placeholders,
  onSaved,
  expanded,
  onToggle,
}: {
  template: SmsTemplate;
  placeholders: SmsPlaceholder[];
  onSaved: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isAutomatic = template.kind !== "MANUAL";
  const dirty = name !== template.name || description !== (template.description ?? "") || body !== template.body;

  async function request(method: "PATCH" | "DELETE", payload?: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/sms/templates/${template.id}`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) setError(json?.reason || "Failed to save");
      else onSaved();
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`rounded-2xl border bg-white ${isAutomatic ? "border-logoblue/30" : "border-black/10"}`}>
      <div className="flex items-center gap-3 p-4">
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className={`shrink-0 text-xs text-textColorThird transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden>
            ▶
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold text-logoblue">{template.name}</span>
            {!expanded ? (
              <span className="block truncate text-sm text-textColorThird">{template.description || template.body}</span>
            ) : null}
          </span>
        </button>
        {isAutomatic ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void request("PATCH", { enabled: !template.enabled })}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
              template.enabled ? "bg-green-600 text-white hover:bg-green-700" : "bg-slate-200 text-textColorThird hover:bg-slate-300"
            }`}
          >
            {template.enabled ? "On" : "Off"}
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="border-t border-black/5 p-4">
          {/* Automatic templates keep their built-in name and description
              (the API rejects changes); only the text is editable. */}
          {isAutomatic ? (
            template.description ? <p className="mb-3 text-sm text-textColorThird">{template.description}</p> : null
          ) : (
            <>
              <label className="mb-3 block">
                <div className="mb-1 text-sm font-medium text-textColorThird">Name</div>
                <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
              </label>

              <label className="mb-3 block">
                <div className="mb-1 text-sm font-medium text-textColorThird">Description (not sent, only shown here)</div>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className={`${inputClass} min-h-16`}
                  placeholder="What is this template for / when is it sent?"
                />
              </label>
            </>
          )}

          <label className="block">
            <div className="mb-1 text-sm font-medium text-textColorThird">Text</div>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} className={`${inputClass} min-h-24`} />
          </label>
          <div className="mt-2">
            <SmsPlaceholderLegend placeholders={placeholders} onInsert={(token) => setBody((current) => `${current}${token}`)} />
          </div>
          <div className="mt-2 text-xs text-textColorThird">
            Template length (before placeholders are filled in): <SmsSegmentInfo text={body} />
          </div>

          {error ? <div className="mt-3 text-sm text-red-700">{error}</div> : null}

          <div className="mt-3 flex justify-end gap-2">
            {!isAutomatic ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (window.confirm(`Delete template "${template.name}"?`)) void request("DELETE");
                }}
                className="rounded-full px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Delete
              </button>
            ) : null}
            <button
              type="button"
              disabled={saving || !dirty || !body.trim() || !name.trim()}
              onClick={() => void request("PATCH", isAutomatic ? { body } : { name, description, body })}
              className="rounded-full bg-logoblue px-5 py-2 text-sm font-semibold text-white transition hover:bg-logoblue/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : error ? (
        <div className="px-4 pb-4 text-sm text-red-700">{error}</div>
      ) : null}
    </div>
  );
}

// Settings page section (OWNER/ADMIN only — the page hides it otherwise and
// the API enforces it).
export default function SmsTemplatesSection() {
  const { data, loading, error, reload } = useSmsTemplates(true);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newBody, setNewBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const toggleExpanded = (id: string) =>
    setExpandedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const placeholders = data?.placeholders ?? [];

  async function handleCreate() {
    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/sms/templates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDescription, body: newBody }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        setCreateError(json?.reason || "Failed to create template");
        return;
      }
      setNewName("");
      setNewDescription("");
      setNewBody("");
      await reload();
    } catch {
      setCreateError("Failed to create template");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="max-w-215 space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-logoblue">SMS templates</h2>
        <p className="mt-1 text-sm text-textColorThird">
          Used by the automatic SMS and the SMS composers in the booking archive. Placeholders are filled in from each order when the SMS is sent.
        </p>
      </div>

      {data && data.configured === false ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SMS is not set up yet (GATEWAYAPI_TOKEN is missing on the server). Templates can still be prepared.
        </div>
      ) : null}

      {loading && !data ? <div className="text-sm text-textColorThird">Loading...</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {data ? (
        <div className="max-h-150 space-y-4 overflow-y-auto rounded-[20px] border border-black/8 bg-slate-50 p-4">
          {sortSmsTemplates(data.templates ?? []).map((template) => (
            // Keyed on content so a reload resets the editor to the saved values.
            <TemplateEditor
              key={`${template.id}:${template.name}:${template.description ?? ""}:${template.body}`}
              template={template}
              placeholders={placeholders}
              onSaved={() => void reload()}
              expanded={expandedIds.includes(template.id)}
              onToggle={() => toggleExpanded(template.id)}
            />
          ))}

          <div className="rounded-2xl border border-dashed border-black/20 bg-white p-4">
            <div className="mb-3 text-base font-semibold text-logoblue">New template</div>
            <label className="mb-3 block">
              <div className="mb-1 text-sm font-medium text-textColorThird">Name</div>
              <input value={newName} onChange={(event) => setNewName(event.target.value)} className={inputClass} placeholder="e.g. Delayed" />
            </label>
            <label className="mb-3 block">
              <div className="mb-1 text-sm font-medium text-textColorThird">Description (optional, not sent)</div>
              <input
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                className={inputClass}
                placeholder="e.g. When the driver is running late"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-sm font-medium text-textColorThird">Text</div>
              <textarea
                value={newBody}
                onChange={(event) => setNewBody(event.target.value)}
                className={`${inputClass} min-h-20`}
                placeholder="Hei {name}! Vi er dessverre forsinket ..."
              />
            </label>
            <div className="mt-2">
              <SmsPlaceholderLegend placeholders={placeholders} onInsert={(token) => setNewBody((current) => `${current}${token}`)} />
            </div>
            {createError ? <div className="mt-3 text-sm text-red-700">{createError}</div> : null}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={creating || !newName.trim() || !newBody.trim()}
                onClick={() => void handleCreate()}
                className="rounded-full bg-logoblue px-5 py-2 text-sm font-semibold text-white transition hover:bg-logoblue/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Adding..." : "Add template"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
