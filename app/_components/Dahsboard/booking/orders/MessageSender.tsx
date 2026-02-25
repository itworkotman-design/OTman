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
    <section className="customContainer mt-4 max-w-250">
      {/* Top row */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-textcolor">
            Recipient (employee)
          </label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="customInput w-full"
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
            className="customInput w-full"
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
          className="customButtonEnabled h-10 disabled:bg-logoblue/60! disabled:cursor-auto!"
        >
          Send email
        </button>
      </div>

      {/* Actions row */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={!canSendSMS}
          onClick={() => onSendGsm(employeeId)}
          className="customButtonEnabled h-10 disabled:bg-logoblue/60! disabled:cursor-auto!"
        >
          Send to GSM
        </button>

        <button
          onClick={onCopySelected}
          className="customButtonDefault h-10 disabled:bg-logoblue/60! disabled:cursor-auto!"
        >
          Copy selected
        </button>

        <button
          onClick={onExportExcel}
          className="customButtonDefault h-10 disabled:bg-logoblue/60! disabled:cursor-auto!"
        >
          Export Excel
        </button>
      </div>
    </section>
  );
}
