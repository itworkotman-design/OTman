"use client";

import { useEffect } from "react";

const HEARTBEAT_MS = 120_000;

export default function SessionHeartbeat() {
  useEffect(() => {
    let disposed = false;

    const sendHeartbeat = () => {
      if (disposed || document.visibilityState !== "visible") return;

      void fetch("/api/auth/heartbeat", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        keepalive: true,
      }).catch(() => {});
    };

    sendHeartbeat();

    const intervalId = window.setInterval(sendHeartbeat, HEARTBEAT_MS);
    const handleVisibilityChange = () => sendHeartbeat();
    const handleFocus = () => sendHeartbeat();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return null;
}
