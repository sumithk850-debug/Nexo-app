"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CloudOff, Wifi } from "lucide-react";

export function ConnectionRecoveryBanner() {
  const [online, setOnline] = useState(true);
  const [justRecovered, setJustRecovered] = useState(false);

  useEffect(() => {
    const updateOnline = () => {
      setOnline(true);
      setJustRecovered(true);
      window.setTimeout(() => setJustRecovered(false), 4_000);
    };
    const updateOffline = () => {
      setOnline(false);
      setJustRecovered(false);
    };

    setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOffline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOffline);
    };
  }, []);

  if (online && !justRecovered) return null;

  const recovered = online && justRecovered;
  return (
    <div
      className={`mx-4 mb-2 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs shadow-sm ${
        recovered
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
          : "border-amber-300/30 bg-amber-300/10 text-amber-100"
      }`}
      role="status"
    >
      {recovered ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> : <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />}
      <div className="min-w-0">
        <p className="font-semibold">{recovered ? "Connection restored" : "You are offline"}</p>
        <p className="mt-0.5 opacity-85">
          {recovered
            ? "Your workspace is ready to continue."
            : "Your current draft remains saved on this device. Reconnect before sending a message."}
        </p>
      </div>
      {recovered && <Wifi className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />}
    </div>
  );
}
