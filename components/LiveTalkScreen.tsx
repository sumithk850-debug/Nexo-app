"use client";

import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, CirclePause, Globe2, Mic, MicOff, PhoneOff, RefreshCw, SlidersHorizontal, Volume2, X } from "lucide-react";

import { authenticatedFetch } from "@/lib/authFetch";

type ConnectionState = "connecting" | "listening" | "speaking" | "paused" | "muted" | "error" | "limit";
type LiveLanguage = "auto" | "si" | "en";
type LiveSpeed = "slow" | "normal" | "fast";

type Preferences = {
  language: LiveLanguage;
  speed: LiveSpeed;
};

type TokenPayload = {
  token: string;
  sessionId: string;
  expiresAt: string;
  remainingSeconds: number;
  model: string;
  preferences: Preferences;
};

const SAMPLE_RATE = 16_000;
const OUTPUT_SAMPLE_RATE = 24_000;
const LEVEL_FLOOR = 0.015;

function base64FromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + step, bytes.length)));
  }
  return window.btoa(binary);
}

function pcm16Buffer(samples: Float32Array): ArrayBuffer {
  const output = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output.buffer;
}

function decodePcm16(base64: string): Float32Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const pcm = new Int16Array(bytes.buffer);
  const output = new Float32Array(pcm.length);
  for (let index = 0; index < pcm.length; index += 1) output[index] = pcm[index] / 0x8000;
  return output;
}

function formatRemaining(seconds: number): string {
  const normalized = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function stateCopy(state: ConnectionState): string {
  switch (state) {
    case "connecting": return "Connecting";
    case "listening": return "Listening";
    case "speaking": return "Nexo is speaking";
    case "paused": return "Paused";
    case "muted": return "Microphone muted";
    case "limit": return "Daily limit reached";
    default: return "Connection needs attention";
  }
}

function languageLabel(language: LiveLanguage) {
  return language === "si" ? "Sinhala" : language === "en" ? "English" : "Auto";
}

export function LiveTalkScreen({ onClose }: { onClose: () => void }) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({ language: "auto", speed: "normal" });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const sessionRef = useRef<Session | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const outputSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const outputQueueTimeRef = useRef(0);
  const mutedRef = useRef(false);
  const finalizedRef = useRef(false);
  const mountedRef = useRef(true);

  const audioScale = useMemo(() => Math.min(1, Math.max(0, audioLevel * 3.4)), [audioLevel]);

  const stopPlayback = useCallback(() => {
    for (const source of outputSourcesRef.current) {
      try { source.stop(); } catch { /* source may already have ended */ }
    }
    outputSourcesRef.current = [];
    if (outputContextRef.current) outputQueueTimeRef.current = outputContextRef.current.currentTime;
  }, []);

  const stopCapture = useCallback(async () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    try { processorRef.current?.disconnect(); } catch { /* cleanup only */ }
    try { sourceRef.current?.disconnect(); } catch { /* cleanup only */ }
    try { silentGainRef.current?.disconnect(); } catch { /* cleanup only */ }
    processorRef.current = null;
    sourceRef.current = null;
    silentGainRef.current = null;
    analyserRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    if (inputContextRef.current && inputContextRef.current.state !== "closed") {
      await inputContextRef.current.close().catch(() => {});
    }
    inputContextRef.current = null;
    setAudioLevel(0);
  }, []);

  const finalizeSession = useCallback(async () => {
    if (finalizedRef.current || !sessionIdRef.current) return;
    finalizedRef.current = true;
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    try {
      await authenticatedFetch("/api/live-talk/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      // The server will safely settle an expired session on the next usage read.
    }
  }, []);

  const releaseResources = useCallback(async (finalize = true) => {
    await stopCapture();
    stopPlayback();
    try { sessionRef.current?.close(); } catch { /* cleanup only */ }
    sessionRef.current = null;
    if (outputContextRef.current && outputContextRef.current.state !== "closed") {
      await outputContextRef.current.close().catch(() => {});
    }
    outputContextRef.current = null;
    if (finalize) await finalizeSession();
  }, [finalizeSession, stopCapture, stopPlayback]);

  const enqueueOutputAudio = useCallback(async (base64: string) => {
    try {
      const samples = decodePcm16(base64);
      if (samples.length === 0) return;
      if (!outputContextRef.current) {
        outputContextRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      }
      const context = outputContextRef.current;
      if (context.state === "suspended") await context.resume();
      const buffer = context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
      buffer.copyToChannel(samples, 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const startAt = Math.max(context.currentTime + 0.04, outputQueueTimeRef.current);
      source.start(startAt);
      outputQueueTimeRef.current = startAt + buffer.duration;
      outputSourcesRef.current.push(source);
      source.onended = () => {
        outputSourcesRef.current = outputSourcesRef.current.filter((candidate) => candidate !== source);
        if (outputSourcesRef.current.length === 0 && mountedRef.current && !mutedRef.current) setConnectionState("listening");
      };
      if (mountedRef.current) setConnectionState("speaking");
    } catch {
      if (mountedRef.current) {
        setErrorMessage("Audio playback needs attention. You can retry the session.");
        setConnectionState("error");
      }
    }
  }, []);

  const handleServerMessage = useCallback((message: LiveServerMessage) => {
    const content = message.serverContent;
    if (content?.interrupted) {
      stopPlayback();
      if (mountedRef.current && !mutedRef.current) setConnectionState("listening");
    }
    for (const part of content?.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) void enqueueOutputAudio(part.inlineData.data);
    }
    if (content?.turnComplete && outputSourcesRef.current.length === 0 && mountedRef.current && !mutedRef.current) {
      setConnectionState("listening");
    }
  }, [enqueueOutputAudio, stopPlayback]);

  const beginCapture = useCallback(async () => {
    if (mediaStreamRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    mediaStreamRef.current = stream;
    const context = new AudioContext({ sampleRate: SAMPLE_RATE });
    inputContextRef.current = context;
    if (context.state === "suspended") await context.resume();

    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    const processor = context.createScriptProcessor(4096, 1, 1);
    const silentGain = context.createGain();
    silentGain.gain.value = 0;
    source.connect(analyser);
    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(context.destination);
    sourceRef.current = source;
    analyserRef.current = analyser;
    processorRef.current = processor;
    silentGainRef.current = silentGain;

    processor.onaudioprocess = (event) => {
      if (mutedRef.current || !sessionRef.current) return;
      const input = event.inputBuffer.getChannelData(0);
      const copy = new Float32Array(input);
      try {
        sessionRef.current.sendRealtimeInput({
          audio: {
            data: base64FromBuffer(pcm16Buffer(copy)),
            mimeType: "audio/pcm;rate=16000",
          },
        });
      } catch {
        // A socket closing between frames is recovered by the normal close path.
      }
    };

    const levels = new Uint8Array(analyser.frequencyBinCount);
    const renderLevel = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(levels);
      let sum = 0;
      for (const value of levels) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }
      const nextLevel = Math.sqrt(sum / levels.length);
      if (mountedRef.current) {
        setAudioLevel(nextLevel < LEVEL_FLOOR ? 0 : nextLevel);
      }
      animationFrameRef.current = requestAnimationFrame(renderLevel);
    };
    renderLevel();
  }, []);

  const start = useCallback(async () => {
    setConnectionState("connecting");
    setErrorMessage(null);
    finalizedRef.current = false;
    try {
      const tokenResponse = await authenticatedFetch("/api/live-talk/token", { method: "POST", cache: "no-store" });
      const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as Partial<TokenPayload> & { error?: string };
      if (!tokenResponse.ok || !tokenPayload.token || !tokenPayload.sessionId || !tokenPayload.expiresAt || !tokenPayload.model) {
        if (tokenResponse.status === 429) setConnectionState("limit");
        else setConnectionState("error");
        setErrorMessage(tokenPayload.error ?? "NEXO Live could not start right now.");
        return;
      }

      sessionIdRef.current = tokenPayload.sessionId;
      setExpiresAt(tokenPayload.expiresAt);
      setRemainingSeconds(Number(tokenPayload.remainingSeconds ?? 0));
      setPreferences(tokenPayload.preferences ?? { language: "auto", speed: "normal" });
      mutedRef.current = false;

      await beginCapture();
      const ai = new GoogleGenAI({ apiKey: tokenPayload.token, httpOptions: { apiVersion: "v1beta" } });
      // Audio policy, VAD and the NEXO Live instruction are locked into the
      // ephemeral token by the server. The client deliberately sends no
      // mutable setup fields that could weaken those restrictions.
      const config = {};
      const session = await ai.live.connect({
        model: tokenPayload.model,
        config,
        callbacks: {
          onopen: () => {
            if (mountedRef.current) setConnectionState("listening");
          },
          onmessage: handleServerMessage,
          onerror: () => {
            if (mountedRef.current) {
              setErrorMessage("The live connection was interrupted. You can retry safely.");
              setConnectionState("error");
            }
          },
          onclose: () => {
            if (mountedRef.current && !finalizedRef.current) {
              setErrorMessage("The live connection ended. You can retry safely.");
              setConnectionState("error");
            }
          },
        },
      });
      sessionRef.current = session;
    } catch (error) {
      console.error("[live-talk] Start failed", error);
      await releaseResources(true);
      if (mountedRef.current) {
        setErrorMessage("Microphone access or the live connection could not be started. Check permission and try again.");
        setConnectionState("error");
      }
    }
  }, [beginCapture, handleServerMessage, releaseResources]);

  const end = useCallback(async () => {
    await releaseResources(true);
    onClose();
  }, [onClose, releaseResources]);

  const retry = useCallback(async () => {
    await releaseResources(true);
    if (mountedRef.current) void start();
  }, [releaseResources, start]);

  const togglePause = useCallback(async () => {
    if (connectionState === "paused") {
      try {
        await beginCapture();
        mutedRef.current = false;
        setConnectionState("listening");
      } catch {
        setErrorMessage("Microphone access is needed to resume NEXO Live.");
        setConnectionState("error");
      }
      return;
    }
    mutedRef.current = true;
    await stopCapture();
    setConnectionState("paused");
  }, [beginCapture, connectionState, stopCapture]);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    if (mutedRef.current) {
      setConnectionState("muted");
    } else {
      setConnectionState("listening");
    }
  }, []);

  const updatePreference = useCallback(async (patch: Partial<Preferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    try {
      await authenticatedFetch("/api/live-talk/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      setErrorMessage("The preference will be retried next time you open NEXO Live.");
    }
  }, [preferences]);

  useEffect(() => {
    mountedRef.current = true;
    void start();
    return () => {
      mountedRef.current = false;
      void releaseResources(true);
    };
  }, [releaseResources, start]);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0) {
        setConnectionState("limit");
        void releaseResources(true);
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, releaseResources]);

  const orbSize = 1 + audioScale * (connectionState === "speaking" ? 0.18 : 0.11);
  const isMuted = connectionState === "muted";
  const canPause = connectionState === "listening" || connectionState === "speaking" || connectionState === "muted" || connectionState === "paused";

  return (
    <section className="fixed inset-0 z-[100] overflow-hidden bg-[#050b1c] text-white" aria-label="Nexo Live Talk">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(8,145,178,0.18),transparent_31%),radial-gradient(circle_at_15%_10%,rgba(67,56,202,0.18),transparent_24%),linear-gradient(145deg,#050b1c,#07172a_48%,#0a1030)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(103,232,249,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,0.035)_1px,transparent_1px)] [background-size:38px_38px]" />

      <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col px-5 pb-7 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${connectionState === "listening" || connectionState === "speaking" ? "bg-cyan shadow-[0_0_16px_rgba(34,211,238,0.95)]" : connectionState === "error" || connectionState === "limit" ? "bg-rose-400" : "bg-amber-300"}`} />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200">NEXO Live</p>
              <p className="mt-0.5 text-xs text-slate-400" aria-live="polite">{stateCopy(connectionState)}</p>
            </div>
          </div>
          <button onClick={() => void end()} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white" aria-label="End NEXO Live" title="End NEXO Live">
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center pb-8">
          <div className="relative flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72" aria-hidden="true">
            <div className={`absolute inset-0 rounded-full border border-cyan-200/15 transition-transform duration-150 ${connectionState === "speaking" ? "animate-pulse" : ""}`} style={{ transform: `scale(${1.04 + audioScale * 0.38})` }} />
            <div className="absolute inset-[9%] rounded-full border border-cyan-100/10" style={{ transform: `scale(${1 + audioScale * 0.24})` }} />
            <div className={`absolute inset-[18%] rounded-full bg-cyan/15 blur-2xl transition-all duration-150 ${connectionState === "speaking" ? "opacity-100" : "opacity-65"}`} style={{ transform: `scale(${1 + audioScale * 0.48})` }} />
            <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-cyan-100/25 bg-[radial-gradient(circle_at_35%_28%,rgba(165,243,252,0.98),rgba(6,182,212,0.82)_38%,rgba(14,116,144,0.74)_72%,rgba(8,47,73,0.85))] shadow-[0_0_70px_rgba(34,211,238,0.38),inset_0_0_26px_rgba(255,255,255,0.24)] transition-transform duration-150" style={{ transform: `scale(${orbSize})` }}>
              {connectionState === "speaking" ? <Volume2 className="h-10 w-10 text-white drop-shadow" /> : isMuted ? <MicOff className="h-10 w-10 text-white drop-shadow" /> : <Mic className="h-10 w-10 text-white drop-shadow" />}
            </div>
          </div>
          <div className="mt-10 text-center">
            <p className="text-lg font-semibold tracking-tight text-white">{connectionState === "error" ? "NEXO Live needs attention" : connectionState === "limit" ? "NEXO Live is complete for today" : connectionState === "speaking" ? "Listening for an interruption" : connectionState === "paused" ? "Your microphone is paused" : isMuted ? "Your microphone is muted" : "Speak naturally"}</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">{connectionState === "error" || connectionState === "limit" ? errorMessage : "Nexo responds by voice. Your raw audio is not saved."}</p>
          </div>
        </main>

        <div className="mx-auto w-full max-w-md space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 backdrop-blur-sm">
            <span className="text-xs font-medium text-slate-400">Today&apos;s Live Talk</span>
            <span className="font-mono text-sm font-bold text-cyan-100">{formatRemaining(remainingSeconds)} remaining</span>
          </div>

          <div className="relative flex items-center justify-center gap-4">
            <button onClick={toggleMute} disabled={!canPause || connectionState === "paused"} className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-cyan/40 hover:bg-cyan/10 disabled:cursor-not-allowed disabled:opacity-35" aria-label={isMuted ? "Unmute microphone" : "Mute microphone"} title={isMuted ? "Unmute microphone" : "Mute microphone"}>
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button onClick={() => void togglePause()} disabled={!canPause} className="flex h-[76px] w-[76px] items-center justify-center rounded-full border border-cyan-200/40 bg-cyan text-[#03121f] shadow-[0_0_28px_rgba(34,211,238,0.4)] transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35" aria-label={connectionState === "paused" ? "Resume listening" : "Pause microphone"} title={connectionState === "paused" ? "Resume" : "Pause"}>
              {connectionState === "paused" ? <Mic className="h-7 w-7" /> : <CirclePause className="h-7 w-7" />}
            </button>
            <button onClick={() => void end()} className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-200/25 bg-rose-500/15 text-rose-200 transition hover:bg-rose-500/25 hover:text-white" aria-label="End NEXO Live" title="End NEXO Live">
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>

          {(connectionState === "error" || connectionState === "limit") && (
            <button onClick={() => connectionState === "limit" ? void end() : void retry()} className="mx-auto flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan/15">
              {connectionState === "limit" ? "Return to chat" : <><RefreshCw className="h-4 w-4" /> Retry NEXO Live</>}
            </button>
          )}

          <div className="relative">
            <button onClick={() => setSettingsOpen((open) => !open)} className="mx-auto flex items-center gap-2 text-xs font-medium text-slate-400 transition hover:text-slate-200" aria-expanded={settingsOpen} aria-controls="live-talk-settings">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {languageLabel(preferences.language)} · {preferences.speed[0].toUpperCase() + preferences.speed.slice(1)}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {settingsOpen && (
              <div id="live-talk-settings" className="absolute bottom-8 left-1/2 z-10 w-full -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0a1428]/95 p-3 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-2 px-1 pb-2 text-xs font-semibold text-slate-300"><Globe2 className="h-3.5 w-3.5 text-cyan" /> Language</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["auto", "si", "en"] as LiveLanguage[]).map((language) => <button key={language} onClick={() => void updatePreference({ language })} className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${preferences.language === language ? "bg-cyan text-[#03121f]" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>{languageLabel(language)}</button>)}
                </div>
                <div className="mt-3 flex items-center gap-2 px-1 pb-2 text-xs font-semibold text-slate-300"><Volume2 className="h-3.5 w-3.5 text-cyan" /> Reply speed</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["slow", "normal", "fast"] as LiveSpeed[]).map((speed) => <button key={speed} onClick={() => void updatePreference({ speed })} className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize transition ${preferences.speed === speed ? "bg-cyan text-[#03121f]" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>{speed}</button>)}
                </div>
                <p className="mt-3 px-1 text-[10px] leading-4 text-slate-500">Updated language and speed apply when the next NEXO Live session starts.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
