"use client";

import { useEffect, useRef, useState } from "react";

type ShiftLeader = { userId: string; username: string } | null;
type Admin = { id: string; username: string };

export default function ShiftLeaderBanner({ currentUserId }: { currentUserId: string | undefined }) {
  const [shiftLeader, setShiftLeader] = useState<ShiftLeader>(null);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [setting, setSetting] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchShiftLeader();
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pickerOpen]);

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

  async function openPicker() {
    setPickerOpen(true);
    if (admins.length > 0) return;
    setLoadingAdmins(true);
    try {
      const res = await fetch("/api/shift-leader/admins", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);
      setAdmins(data?.admins ?? []);
    } finally {
      setLoadingAdmins(false);
    }
  }

  async function setShiftLeaderTo(userId: string) {
    if (setting) return;
    setSetting(userId);
    setPickerOpen(false);
    try {
      const res = await fetch("/api/shift-leader", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        setShiftLeader(data.shiftLeader);
      }
    } finally {
      setSetting(null);
    }
  }

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

      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          onClick={() => (pickerOpen ? setPickerOpen(false) : void openPicker())}
          disabled={setting !== null}
          title="Set shift leader"
          className="ml-1 flex items-center justify-center text-textColorThird hover:text-logoblue transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        </button>

        {pickerOpen && (
          <div className="absolute left-0 top-8 z-50 min-w-40 rounded-md border border-lineSecondary bg-white shadow-md py-1">
            {loadingAdmins ? (
              <div className="px-3 py-2 text-xs text-textColorThird">Loading...</div>
            ) : admins.length === 0 ? (
              <div className="px-3 py-2 text-xs text-textColorThird">No admins found</div>
            ) : (
              admins.map((admin) => (
                <button
                  key={admin.id}
                  type="button"
                  onClick={() => void setShiftLeaderTo(admin.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-logoblue transition-colors duration-100 ${
                    shiftLeader?.userId === admin.id ? "font-semibold text-logoblue" : "text-textcolor"
                  }`}
                >
                  {admin.username}
                  {shiftLeader?.userId === admin.id && (
                    <span className="ml-1 text-xs text-green-500">✓</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
