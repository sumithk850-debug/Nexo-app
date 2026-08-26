"use client";

import {
  ArrowLeft,
  AudioLines,
  CircleStop,
  EllipsisVertical,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  Volume2,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/authFetch";

type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

type VoiceResponse = {
  text?: string;
  error?: string;
};

type NexoLivePanelProps = {
  onClose: () => void;
};

const MAX_RECORDING_MS = 60_000;
const WAVE_HEIGHTS = [14, 23, 34, 19, 43, 28, 52, 22, 37, 58, 31, 20, 45, 27, 62, 35, 18, 48, 30, 54, 25, 40, 20, 49, 34, 22, 43, 29, 55, 17];

function chooseRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(new Error("Voice recording could not be read."));
    reader.readAsDataURL(blob);
  });
}

function stateLabel(state: VoiceState) {
  if (state === "listening") return "Listening…";
  if (state === "processing") return "Processing your voice…";
  if (state === "speaking") return "Nexo is speaking…";
  if (state === "error") return "Voice connection needs attention";
  return "Ready to talk";
}

export function NexoLivePanel({ onClose }: NexoLivePanelProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [muted, setMuted] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0.22);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [showStatus, setShowStatus] = useState(false);

  const mountedRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const mutedRef = useRef(false);

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    speechRef.current = null;
  }, []);

  const resetAudioState = useCallback(() => {
    clearRecordingTimer();
    stopStream();
    recorderRef.current = null;
    setRecordingSeconds(0);
    setAudioLevel(0.22);
  }, [clearRecordingTimer, stopStream]);

  const submitRecording = useCallback(async (blob: Blob, mimeType: string) => {
    if (blob.size === 0) {
      if (mountedRef.current) {
        setErrorMessage("No voice was captured. Please try again.");
        setVoiceState("error");
      }
      return;
    }

    try {
      const audioData = await blobToBase64(blob);
      const response = await authenticatedFetch("/api/nexo/voice", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioData, mimeType: mimeType || blob.type || "audio/webm" }),
      });
      const payload = await response.json().catch(() => ({})) as VoiceResponse;
      if (!response.ok || !payload.text) throw new Error(payload.error ?? "Nexo could not complete that voice turn.");
      if (!mountedRef.current) return;

      setResponseText(payload.text);
      setErrorMessage(null);
      setVoiceState("speaking");
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(payload.text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.onend = () => {
          if (mountedRef.current) setVoiceState("idle");
        };
        utterance.onerror = () => {
          if (mountedRef.current) setVoiceState("idle");
        };
        speechRef.current = utterance;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } else {
        setVoiceState("idle");
      }
    } catch (cause) {
      if (mountedRef.current) {
        setErrorMessage(cause instanceof Error ? cause.message : "Nexo could not complete that voice turn.");
        setVoiceState("error");
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearRecordingTimer();
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, [clearRecordingTimer]);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setVoiceState("listening");
    setResponseText("");

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Microphone recording is not supported on this device.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const mimeType = chooseRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        resetAudioState();
        if (mountedRef.current) {
          setErrorMessage("Microphone recording stopped unexpectedly. Please retry.");
          setVoiceState("error");
        }
      };
      recorder.onstop = () => {
        const recordedMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: recordedMimeType });
        resetAudioState();
        if (mountedRef.current) setVoiceState("processing");
        void submitRecording(blob, recordedMimeType);
      };
      recorder.start(250);
      recordingTimerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - recordingStartedAtRef.current;
        setRecordingSeconds(Math.min(60, Math.floor(elapsed / 1_000)));
        setAudioLevel(0.18 + ((Math.sin(elapsed / 170) + 1) / 2) * 0.62);
        if (elapsed >= MAX_RECORDING_MS) stopRecording();
      }, 120);
    } catch (cause) {
      resetAudioState();
      if (mountedRef.current) {
        setErrorMessage(cause instanceof Error ? cause.message : "Microphone access was not available.");
        setVoiceState("error");
      }
    }
  }, [resetAudioState, stopRecording, submitRecording]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearRecordingTimer();
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      } catch {
        // The recorder may already be closed by the browser.
      }
      stopStream();
      stopSpeech();
    };
  }, [clearRecordingTimer, stopSpeech, stopStream]);

  const handleMic = () => {
    if (voiceState === "listening") {
      stopRecording();
      return;
    }
    if (voiceState === "processing" || voiceState === "speaking") return;
    stopSpeech();
    void startRecording();
  };

  const handleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) stopSpeech();
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setVoiceState("idle");
    void startRecording();
  };

  const handleEnd = () => {
    if (voiceState === "listening") stopRecording();
    resetAudioState();
    stopSpeech();
    onClose();
  };

  const isError = voiceState === "error";
  const isConnected = voiceState === "listening" || voiceState === "processing" || voiceState === "speaking";
  const isBusy = voiceState === "processing" || voiceState === "speaking";

  return (
    <section className="fixed inset-0 z-[100] overflow-y-auto bg-[#050615] text-white" aria-label="NEXO Live">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute left-1/2 top-[18%] h-80 w-80 -translate-x-1/2 rounded-full blur-[100px] transition-colors duration-500 ${isError ? "bg-red-600/20" : "bg-violet-600/20"}`} />
        <div className="absolute bottom-[-8rem] right-[-5rem] h-72 w-72 rounded-full bg-indigo-500/10 blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-5 pb-7 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <button onClick={handleEnd} className="grid h-10 w-10 place-items-center rounded-full text-white/90 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-violet-400" aria-label="Back to chat">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-base font-semibold tracking-tight"><AudioLines className="h-5 w-5 text-violet-400" /><span>NEXO Live</span></div>
          <button onClick={() => setShowStatus((value) => !value)} className="grid h-10 w-10 place-items-center rounded-full text-white/75 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-violet-400" aria-label="Show voice session status"><EllipsisVertical className="h-5 w-5" /></button>
        </header>

        {showStatus && (
          <div className="absolute right-5 top-16 z-20 w-56 rounded-2xl border border-violet-300/20 bg-[#121329]/95 p-3 text-xs text-white/75 shadow-2xl backdrop-blur-xl">
            <p className="font-semibold text-white">NEXO Live</p>
            <p className="mt-1 leading-5">Speak naturally and stop the recording when you are ready.</p>
          </div>
        )}

        <div className="mt-10 flex items-center justify-center">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${isError ? "border-red-400/40 bg-red-500/15 text-red-200" : "border-pink-400/30 bg-pink-500/15 text-pink-100"}`}>
            <span className={`h-2 w-2 rounded-full ${isError ? "bg-red-400" : "animate-pulse bg-pink-400"}`} />
            {isError ? "Connection issue" : "Live Session"}
          </span>
        </div>

        <main className="flex flex-1 flex-col items-center justify-center py-12">
          <button onClick={handleMic} disabled={isBusy} className={`relative grid h-44 w-44 place-items-center rounded-full border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-default ${isError ? "border-red-400/40 bg-red-500/10 shadow-[0_0_70px_rgba(248,113,113,0.18)]" : voiceState === "listening" ? "border-violet-300/60 bg-violet-500/15 shadow-[0_0_95px_rgba(139,92,246,0.48)]" : "border-violet-400/35 bg-violet-600/10 shadow-[0_0_80px_rgba(124,58,237,0.35)]"}`} aria-label={voiceState === "listening" ? "Stop recording" : "Start recording"}>
            <span className={`absolute inset-4 rounded-full border ${isError ? "border-red-300/30" : "border-violet-400/35"}`} />
            <span className={`absolute inset-9 rounded-full ${isError ? "bg-red-500/15" : "bg-violet-500/15"}`} />
            <span className={`relative grid h-20 w-20 place-items-center rounded-full border shadow-xl ${isError ? "border-red-300/60 bg-red-500/80" : "bg-gradient-to-br from-violet-400 to-indigo-700 border-violet-300/70"}`}>
              {muted ? <MicOff className="h-9 w-9" /> : <Mic className="h-9 w-9" />}
            </span>
          </button>

          <h1 className="mt-10 text-center text-2xl font-semibold tracking-tight">{stateLabel(voiceState)}</h1>
          {voiceState === "listening" && <p className="mt-2 text-xs text-white/55">Recording · {recordingSeconds}s / 60s</p>}
          <div className="mt-6 flex h-16 items-center justify-center gap-1.5" aria-hidden="true">
            {WAVE_HEIGHTS.map((height, index) => {
              const liveMultiplier = voiceState === "listening" ? audioLevel : voiceState === "speaking" ? 0.82 + ((index % 3) * 0.12) : 0.5;
              return <span key={index} className={`w-1 rounded-full transition-[height,background-color] duration-150 ${isError ? "bg-red-400/65" : "bg-violet-400"}`} style={{ height: `${Math.max(5, height * liveMultiplier)}px` }} />;
            })}
          </div>

          {responseText && !isError && (
            <div className="mt-5 w-full max-w-sm rounded-2xl border border-violet-300/20 bg-violet-500/[0.09] p-4 text-sm leading-6 text-violet-50 shadow-inner">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-violet-200"><Sparkles className="h-4 w-4" /> Nexo response</div>
              <p>{responseText}</p>
            </div>
          )}

          {isError && (
            <div role="alert" className="mt-6 w-full max-w-sm rounded-2xl border border-red-400/45 bg-red-950/45 p-4 text-center shadow-[0_0_30px_rgba(239,68,68,0.14)]">
              <p className="text-sm font-semibold text-red-100">Voice connection error</p>
              <p className="mt-1 text-xs leading-5 text-red-200/90">{errorMessage ?? "Nexo could not complete that voice turn. Please retry."}</p>
              <button onClick={handleRetry} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-400 active:scale-95"><RotateCcw className="h-3.5 w-3.5" /> Retry</button>
            </div>
          )}

          {!responseText && !isError && voiceState !== "listening" && <div className="mt-5 rounded-2xl border border-violet-400/15 bg-violet-500/[0.08] px-4 py-3 text-center text-sm text-violet-100/90"><Sparkles className="mr-2 inline h-4 w-4 text-violet-300" /> Tap the microphone and speak naturally…</div>}
        </main>

        <footer className="space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${muted ? "border-white/15 bg-white/5 text-white/50" : "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"}`}><span className={`h-2 w-2 rounded-full ${muted ? "bg-white/35" : "bg-emerald-400"}`} /> Microphone {muted ? "Muted" : "Active"}</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${isConnected ? "border-violet-300/25 bg-violet-500/10 text-violet-100" : "border-white/15 bg-white/5 text-white/55"}`}><Wifi className="h-3.5 w-3.5" /> {isConnected ? "Connected" : "Ready"}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/75"><Volume2 className="h-3.5 w-3.5" /> NEXO Voice</span>
          </div>
          <div className="flex gap-3">
            <button onClick={handleMute} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]">{muted ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}{muted ? "Unmute" : "Mute"}</button>
            <button onClick={handleEnd} className="flex h-12 flex-[1.35] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-red-500 text-sm font-bold text-white shadow-[0_12px_35px_rgba(239,68,68,0.3)] transition hover:from-rose-500 hover:to-red-400 active:scale-[0.98]"><CircleStop className="h-4 w-4" /> End Talk</button>
          </div>
        </footer>
      </div>
    </section>
  );
}
