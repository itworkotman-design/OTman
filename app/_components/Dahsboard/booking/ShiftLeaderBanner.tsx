"use client";

import { useEffect, useState } from "react";

type ShiftLeader = { userId: string; username: string } | null;

export default function ShiftLeaderBanner({ currentUserId }: { currentUserId: string | undefined }) {
  const [shiftLeader, setShiftLeader] = useState<ShiftLeader>(null);
  const [loading, setLoading] = useState(true);
  const [setting, setSetting] = useState(false);

  useEffect(() => {
    void fetchShiftLeader();
  }, []);

  async function fetchShiftLeader() {
    try {
      const res = await fetch("/api/shift-leader", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);
      setShiftLeader(data?.shiftLeader ?? null);
    } catch {
      setShiftLeader(null);
    } finally {
      setLoading(false);
    }
  }

  async function becomeShiftLeader() {
    if (setting) return;
    setSetting(true);
    try {
      const res = await fetch("/api/shift-leader", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        setShiftLeader(data.shiftLeader);
      }
    } finally {
      setSetting(false);
    }
  }

  const isCurrentUserLeader = shiftLeader && currentUserId && shiftLeader.userId === currentUserId;

  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-sm font-medium text-textColorSecond whitespace-nowrap">
        Shift leader:
      </span>

      {loading ? (
        <span className="text-sm text-textColorThird">...</span>
      ) : shiftLeader ? (
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0"
            title="Active"
          />
          <span className="text-sm font-semibold text-textcolor">{shiftLeader.username}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full bg-gray-300 shrink-0"
            title="No shift leader"
          />
          <span className="text-sm text-textColorThird italic">No shift leader</span>
        </div>
      )}

      {!isCurrentUserLeader && (
        <button
          type="button"
          onClick={() => void becomeShiftLeader()}
          disabled={setting}
          title="Become shift leader"
          className="ml-1 flex items-center justify-center w-6 h-6 rounded-full border border-lineSecondary text-textColorThird hover:border-logoblue hover:text-logoblue hover:bg-blue-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
        >
          ↑
        </button>
      )}
    </div>
  );
}
