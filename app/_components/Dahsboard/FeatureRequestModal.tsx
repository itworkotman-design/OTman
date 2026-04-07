"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type FeatureRequestModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit?: (payload: {
    type: "bug fix" | "new function" | "other";
    details: string;
  }) => void;
};

export default function FeatureRequestModal({
  open,
  onClose,
  onSubmit,
}: FeatureRequestModalProps) {
  const [type, setType] = useState<"bug fix" | "new function" | "other">(
    "new function",
  );
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setType("new function");
      setDetails("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const payload = { type, details };
      onSubmit?.(payload);

      // optional API call placeholder (backend schema to be implemented by user)
      await fetch("/api/feature-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      onClose();
    } catch {
      setError("Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="relative w-full max-w-200 max-h-375 overflow-auto customContainer bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-logoblue text-white cursor-pointer"
          >
            ×
          </button>
        </div>

        <h2 className="mb-4 text-xl font-bold text-logoblue">
          Request new function
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Type of request
          </label>
          <select
            value={type}
            onChange={(e) =>
              setType(e.target.value as "bug fix" | "new function" | "other")
            }
            className="w-full rounded-md border px-3 py-2 customInput"
          >
            <option value="bug fix">Bug fix</option>
            <option value="new function">New function</option>
            <option value="other">Other</option>
          </select>

          <label className="block text-sm font-medium text-gray-700">
            Details
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={5}
            className="w-full rounded-md border px-3 py-2 customInput"
            placeholder="Describe the issue or request..."
            required
          />

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="customButtonDefault"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="customButtonEnabled"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
