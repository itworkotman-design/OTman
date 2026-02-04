"use client";

import { useState } from "react";

type Employee = {
  id: string;
  name: string;
};

type MessageSenderProps = {
  employees: Employee[];
  onSendEmail: (employeeId: string, type: string) => void | Promise<void>;
  onSendGsm: (employeeId: string) => void | Promise<void>;
  onCopySelected: () => void;
  onExportExcel: () => void;
};

export function MessageSender({
  employees,
  onSendEmail,
  onSendGsm,
  onCopySelected,
  onExportExcel,
}: MessageSenderProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [emailType, setEmailType] = useState("");

  const canSendEmail = employeeId !== "" && emailType !== "";
  const canSendSMS = employeeId !== "";

  return (
    <section className="mt-4 rounded-xl border p-4 max-w-250">
      {/* Top row */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-textcolor">
            Recipient (employee)
          </label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="h-10 w-full rounded-md border px-3 text-sm"
          >
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-textcolor">
            Email type
          </label>
          <select
            value={emailType}
            onChange={(e) => setEmailType(e.target.value)}
            className="h-10 w-full rounded-md border px-3 text-sm"
          >
            <option value="">Select type…</option>
            <option value="prepare_orders">Prepare orders</option>
            <option value="confirmed_delivery">Confirmed for delivery</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <button
          disabled={!canSendEmail}
          onClick={() => onSendEmail(employeeId, emailType)}
          className="h-10 rounded-md bg-logoblue px-4 text-sm font-semibold text-white disabled:bg-logoblue/60"
        >
          Send email
        </button>
      </div>

      {/* Actions row */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={!canSendSMS}
          onClick={() => onSendGsm(employeeId)}
          className="h-9 rounded-md bg-logoblue font-semibold border px-3 text-sm text-white disabled:bg-logoblue/60"
        >
          Send to GSM
        </button>

        <button
          onClick={onCopySelected}
          className="h-9 rounded-md border px-3 text-sm"
        >
          Copy selected
        </button>

        <button
          onClick={onExportExcel}
          className="h-9 rounded-md border px-3 text-sm"
        >
          Export Excel
        </button>
      </div>
    </section>
  );
}
