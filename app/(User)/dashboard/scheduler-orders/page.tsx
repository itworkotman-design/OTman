"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import AutomaticOrderModal, {
  type AutomaticOrderTemplate,
} from "@/app/_components/Dahsboard/automaticOrders/AutomaticOrderModal";
import { describeRecurrence } from "@/lib/orders/recurringOrders/recurrenceSummary";
import type { TemplateHealthStatus } from "@/lib/orders/recurringOrders/templateHealth";

type TemplateOccurrence = {
  id: string;
  occurrenceDate: string;
  status: "PENDING" | "CREATED" | "SKIPPED" | "FAILED";
  orderId: string | null;
  failureReason: string | null;
  generatedAt: string | null;
  updatedAt: string;
};

type TemplateRow = AutomaticOrderTemplate & {
  isPaused: boolean;
  createdAt: string;
  updatedAt: string;
  nextOccurrenceDate: string | null;
  health: TemplateHealthStatus;
  recentOccurrences: TemplateOccurrence[];
};

const HEALTH_BADGE_CLASS: Record<TemplateHealthStatus, string> = {
  VALID: "bg-green-500/20 text-green-700",
  WARNING: "bg-amber-500/20 text-amber-700",
  BROKEN: "bg-red-500/20 text-red-700",
};

export default function AutomaticOrdersPage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateSummary, setGenerateSummary] = useState("");

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/automatic-orders", { credentials: "include" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to load scheduler orders");
        return;
      }

      setTemplates(data.templates);
    } catch {
      setError("Failed to load scheduler orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  async function togglePause(template: TemplateRow) {
    const res = await fetch(`/api/automatic-orders/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isPaused: !template.isPaused }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      alert(data?.reason || "Failed to update scheduler order");
      return;
    }

    await loadTemplates();
  }

  async function handleDelete(template: TemplateRow) {
    const confirmMessage =
      locale === "nb" ? "Slette denne planlagte bestillingen?" : "Delete this scheduler order?";
    if (!confirm(confirmMessage)) return;

    const res = await fetch(`/api/automatic-orders/${template.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      alert(data?.reason || "Failed to delete scheduler order");
      return;
    }

    await loadTemplates();
  }

  async function handleGenerateNow() {
    setGenerating(true);
    setGenerateSummary("");

    try {
      const res = await fetch("/api/automatic-orders/generate-now", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        alert(data?.reason || "Failed to generate scheduler orders");
        return;
      }

      setGenerateSummary(
        locale === "nb"
          ? `Opprettet: ${data.created}, hoppet over: ${data.skipped}, feilet: ${data.failed}`
          : `Created: ${data.created}, skipped: ${data.skipped}, failed: ${data.failed}`,
      );

      await loadTemplates();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-w-0 max-w-1800">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
          {locale === "nb" ? "Planlagte bestillinger" : "Scheduler Orders"}
        </h1>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="customButtonDefault"
            disabled={generating}
            onClick={handleGenerateNow}
          >
            {generating
              ? locale === "nb"
                ? "Genererer..."
                : "Generating..."
              : locale === "nb"
                ? "Generer forfalte planlagte bestillinger nå"
                : "Generate due scheduler orders now"}
          </button>
          <button
            type="button"
            className="customButtonEnabled"
            onClick={() => {
              setSelectedTemplate(null);
              setModalOpen(true);
            }}
          >
            {locale === "nb" ? "Ny planlagt bestilling" : "New scheduler order"}
          </button>
        </div>
      </div>

      {generateSummary ? (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {generateSummary}
        </div>
      ) : null}

      {error ? <div className="mb-4 text-red-600">{error}</div> : null}

      {loading ? (
        <p className="text-textColorThird">{locale === "nb" ? "Laster..." : "Loading..."}</p>
      ) : templates.length === 0 ? (
        <p className="text-textColorThird">
          {locale === "nb" ? "Ingen planlagte bestillinger enda." : "No scheduler orders yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900] border-collapse text-sm">
            <thead>
              <tr className="border-b border-lineSecondary text-left text-textColorSecond">
                <th className="p-2">{locale === "nb" ? "Navn" : "Name"}</th>
                <th className="p-2">{locale === "nb" ? "Gjentakelse" : "Recurrence"}</th>
                <th className="p-2">{locale === "nb" ? "Neste dato" : "Next date"}</th>
                <th className="p-2">{locale === "nb" ? "Ledetid" : "Lead time"}</th>
                <th className="p-2">{locale === "nb" ? "Status" : "Status"}</th>
                <th className="p-2">{locale === "nb" ? "Helse" : "Health"}</th>
                <th className="p-2">{locale === "nb" ? "Handlinger" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <Fragment key={template.id}>
                  <tr className="border-b border-lineSecondary/50">
                    <td className="p-2 font-medium">{template.name}</td>
                    <td className="p-2">
                      {describeRecurrence(template.recurrenceType, template.recurrenceConfig, locale)}
                    </td>
                    <td className="p-2">{template.nextOccurrenceDate ?? "-"}</td>
                    <td className="p-2">{template.leadTimeDays}</td>
                    <td className="p-2">
                      {template.isPaused
                        ? `${locale === "nb" ? "Pauset" : "Paused"} — ${
                            locale === "nb" ? "neste mulige" : "next possible"
                          }: ${template.nextOccurrenceDate ?? "-"}`
                        : locale === "nb"
                          ? "Aktiv"
                          : "Active"}
                    </td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${HEALTH_BADGE_CLASS[template.health]}`}>
                        {template.health}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="customButtonDefault"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setModalOpen(true);
                          }}
                        >
                          {locale === "nb" ? "Rediger" : "Edit"}
                        </button>
                        <button type="button" className="customButtonDefault" onClick={() => togglePause(template)}>
                          {template.isPaused
                            ? locale === "nb"
                              ? "Gjenoppta"
                              : "Resume"
                            : locale === "nb"
                              ? "Pause"
                              : "Pause"}
                        </button>
                        <button
                          type="button"
                          className="customButtonDefault"
                          onClick={() => setExpandedId((id) => (id === template.id ? null : template.id))}
                        >
                          {locale === "nb" ? "Historikk" : "History"}
                        </button>
                        <button
                          type="button"
                          className="customButtonDefault bg-red-600! text-white!"
                          onClick={() => handleDelete(template)}
                        >
                          {locale === "nb" ? "Slett" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === template.id ? (
                    <tr>
                      <td colSpan={7} className="bg-linePrimary/40 p-3">
                        {template.recentOccurrences.length === 0 ? (
                          <p className="text-sm text-textColorThird">
                            {locale === "nb" ? "Ingen genereringer enda." : "No generations yet."}
                          </p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-textColorThird">
                                <th className="p-1">{locale === "nb" ? "Dato" : "Date"}</th>
                                <th className="p-1">Status</th>
                                <th className="p-1">{locale === "nb" ? "Detaljer" : "Details"}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {template.recentOccurrences.map((occurrence) => (
                                <tr key={occurrence.id}>
                                  <td className="p-1">{occurrence.occurrenceDate}</td>
                                  <td className="p-1">{occurrence.status}</td>
                                  <td className="p-1">
                                    {occurrence.status === "FAILED"
                                      ? `${occurrence.failureReason ?? ""} (${new Date(occurrence.updatedAt).toLocaleString()})`
                                      : occurrence.status === "CREATED"
                                        ? locale === "nb"
                                          ? "Bestilling opprettet"
                                          : "Order created"
                                        : ""}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AutomaticOrderModal
        open={modalOpen}
        template={selectedTemplate}
        onClose={() => {
          setModalOpen(false);
          setSelectedTemplate(null);
        }}
        onSaved={loadTemplates}
        locale={locale}
      />
    </div>
  );
}
