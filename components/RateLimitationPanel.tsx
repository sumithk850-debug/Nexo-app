"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, X, Zap, Clock, TrendingUp, RefreshCw } from "lucide-react";
import type { NexoModelId } from "@/lib/models";
import { authenticatedFetch } from "@/lib/authFetch";

interface ModelUsage {
  id: string;
  name: string;
  color: string;
  gradient: string;
  icon: string;
}

const MODEL_CONFIGS: ModelUsage[] = [
  { id: "nexio-1.1", name: "Nexio 1.1", color: "#06b6d4", gradient: "from-cyan-400 to-cyan-600", icon: "⚡" },
  { id: "spadec-3.5", name: "Spadec 3.5", color: "#8b5cf6", gradient: "from-violet-400 to-violet-600", icon: "🎨" },
  { id: "galex-4.0", name: "Galex 4.0", color: "#f59e0b", gradient: "from-amber-400 to-amber-600", icon: "🔥" },
  { id: "brainex-10.8", name: "Brainex 10.8", color: "#10b981", gradient: "from-emerald-400 to-emerald-600", icon: "🧠" },
  { id: "craft-v3", name: "Craft V3", color: "#ef4444", gradient: "from-red-400 to-red-600", icon: "🛠️" },
];

interface UsageData {
  nexio: number;
  spadec: number;
  galex: number;
  brainex: number;
  craft: number;
  total: number;
  messageCount: number;
  coderCount: number;
  coderPausedUntil: string | null;
  date: string;
}

interface Limits {
  nexio: { tokens: number; messages: number };
  spadec: { tokens: number; messages: number };
  galex: { tokens: number; messages: number };
  brainex: { tokens: number; messages: number };
  craft: { tokens: number; messages: number };
}

interface NexoLiveUsage {
  usedSeconds: number;
  remainingSeconds: number;
  limitSeconds: number;
  resetAt: string;
}

interface Props {
  sessionId: string;
  theme: { edge: string };
  open: boolean;
  onClose: () => void;
}

function formatNumber(num: number): string {
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toString();
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function CircularProgress({ percentage, color, size = 48 }: { percentage: number; color: string; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(percentage / 100, 1));

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

function ModelRow({ config, used, limit }: { config: ModelUsage; used: number; limit: number }) {
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <CircularProgress percentage={pct} color={config.color} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-200">{config.icon} {config.name}</span>
          <span className="text-xs text-gray-400">{formatNumber(used)} / {formatNumber(limit)}</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-1000 ease-out`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function RateLimitationPanel({ sessionId, theme, open, onClose }: Props) {

  const handleRefresh = async () => {
    await fetchUsage();
  };
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [nexoLiveUsage, setNexoLiveUsage] = useState<NexoLiveUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeUntilReset, setTimeUntilReset] = useState("");

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const [res, liveRes] = await Promise.all([
        fetch("/api/usage", {
          headers: { "x-session-id": sessionId },
          cache: "no-store",
        }),
        authenticatedFetch("/api/nexo/voice/usage", { cache: "no-store" }),
      ]);
      if (res.ok) {
        const data = await res.json();
        setUsage(data.usage);
        setLimits(data.limits);
      }
      if (liveRes.ok) {
        const data = await liveRes.json() as { usage?: NexoLiveUsage };
        setNexoLiveUsage(data.usage ?? null);
      } else {
        setNexoLiveUsage(null);
      }
    } catch {
      setNexoLiveUsage(null);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    // Always refetch on open to get the latest usage data
    if (open && sessionId) fetchUsage();
  }, [open, sessionId, fetchUsage]);

  // Countdown to midnight reset
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeUntilReset(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!open) return null;

  const totalUsed = usage?.total ?? 0;
  const totalLimit = Object.values(limits ?? {}).reduce((sum, l) => sum + l.tokens, 0);
  const totalPct = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;
  const livePct = nexoLiveUsage && nexoLiveUsage.limitSeconds > 0
    ? (nexoLiveUsage.usedSeconds / nexoLiveUsage.limitSeconds) * 100
    : 0;
  const coderResumeAt = usage?.coderPausedUntil ? new Date(usage.coderPausedUntil) : null;
  const coderIsPaused = Boolean(coderResumeAt && coderResumeAt.getTime() > Date.now());

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-[92%] max-w-md rounded-2xl border border-white/10 bg-[#0d0d12] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Usage Dashboard</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Refresh usage data"
            >
              <RefreshCw size={14} className={`text-gray-400 ${loading ? "animate-spin text-cyan-400" : "hover:text-cyan-400"}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={16} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-white/5" />

        {/* Content */}
        <div className="px-5 py-3 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Total Usage Card */}
          <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border border-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Total Tokens Today</p>
                <p className="text-2xl font-bold text-white mt-1">{formatNumber(totalUsed)}</p>
                <p className="text-xs text-gray-500 mt-0.5">of {formatNumber(totalLimit)} tokens</p>
              </div>
              <CircularProgress percentage={totalPct} color="#06b6d4" size={56} />
            </div>
          </div>

          {/* NEXO Live daily allowance */}
          <div className="rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-500/15 to-indigo-500/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-violet-200">NEXO Live</p>
                <p className="mt-1 text-sm font-semibold text-white">Daily voice allowance</p>
                <p className="mt-1 text-xs text-violet-200/70">
                  {nexoLiveUsage ? `${formatDuration(nexoLiveUsage.usedSeconds)} used of ${formatDuration(nexoLiveUsage.limitSeconds)}` : "20:00 available each day"}
                </p>
              </div>
              <CircularProgress percentage={livePct} color="#8b5cf6" size={52} />
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-400 transition-all duration-700" style={{ width: `${Math.min(livePct, 100)}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-white/55">
              <span>{nexoLiveUsage ? `${formatDuration(nexoLiveUsage.remainingSeconds)} remaining` : "Sign in to view usage"}</span>
              <span>Resets daily</span>
            </div>
          </div>

          {/* Messages Count */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl bg-white/5 border border-white/5 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={12} className="text-amber-400" />
                <span className="text-xs text-gray-400">Messages</span>
              </div>
              <p className="text-lg font-bold text-white">{usage?.messageCount ?? 0}</p>
            </div>
            <div className="flex-1 rounded-xl bg-white/5 border border-white/5 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 size={12} className="text-red-400" />
                <span className="text-xs text-gray-400">Coder</span>
              </div>
              <p className="text-lg font-bold text-white">{usage?.coderCount ?? 0}</p>
            </div>
            <div className="flex-1 rounded-xl bg-white/5 border border-white/5 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock size={12} className="text-green-400" />
                <span className="text-xs text-gray-400">Reset</span>
              </div>
              <p className="text-sm font-mono font-bold text-white mt-0.5">{timeUntilReset}</p>
            </div>
          </div>

          {coderIsPaused && coderResumeAt && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-xs font-semibold text-red-300">NEXO Coder is paused</p>
              <p className="mt-1 text-[11px] leading-relaxed text-red-200/80">
                Craft V3&apos;s 3K-token budget is exhausted. This chat can continue at {coderResumeAt.toLocaleString()}.
              </p>
            </div>
          )}

          {/* Per-model breakdown */}
          <div className="rounded-xl bg-white/5 border border-white/5 p-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">Per-Model Token Usage</p>
            <div className="space-y-1">
              {MODEL_CONFIGS.map((config) => {
                const key = config.id.split("-")[0] as keyof Limits;
                const used = usage ? Number(usage[key as keyof UsageData] ?? 0) : 0;
                const limit = limits ? Number(limits[key]?.tokens ?? 0) : 0;
                return (
                  <ModelRow key={config.id} config={config} used={used} limit={limit} />
                );
              })}
            </div>
          </div>

          {/* Note */}
          <p className="text-[10px] text-gray-500 text-center">
            Token counts are estimates. Craft V3 pauses for exactly 24 hours after its 3K-token budget is exhausted; other limits reset daily at midnight (UTC).
          </p>
        </div>
      </div>
    </div>
  );
}
