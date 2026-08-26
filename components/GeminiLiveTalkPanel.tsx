"use client";

import { GoogleGenAI, Modality, type Session } from "@google/genai";
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
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/authFetch";

type TalkState = "connecting" | "listening" | "speaking" | "error" | "ended";

type TokenPayload = {
  token: string;
  model: string;
  expiresAt: string;
};

type LiveMessage = {
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> };
  };
};

type GeminiLiveTalkPanelProps = {
  onClose: () => void;
};

const INPUT_SAMPLE_RATE = 16_000;
const OUTPUT_SAMPLE_RATE = 24_000;
const WAVE_COUNT = 30;
const BAR_HEIGHTS = [15, 25, 36, 19, 44, 29, 52, 22, 38, 58, 32, 20, 45, 28, 62, 34, 18, 48, 31, 54, 26, 40, 21, 49, 35, 23, 43, 30, 55, 18];

function encodeBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

function pcm16Buffer(input: Float32Array, fromRate: number, toRate: number) {
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.round(input.length / ratio));
  const output = new Int16Array(length);

  for (let i = 0; i < length; i += 1) {
    const sourceIndex = Math.min(input.length - 1, Math.floor(i * ratio));
    const sample = Math.max(-1, Math.min(1, input[sourceIndex] ?? 0));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return output.buffer;
}

function decodePcm16(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const input = new Int16Array(bytes.buffer);
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1) output[i] = (input[i] ?? 0) / 0x8000;
  return output;
}

function messageForState(state: TalkState) {
  if (state === "connecting") return "Connecting to Gemini Live…";
  if (state === "speaking") return "Nexo is speaking…";
  if (state === "ended") return "Live Talk ended";
  if (state === "error") return "Live connection needs attention";
  return "Listening…";
}

export function GeminiLiveTalkPanel({ onClose }: GeminiLiveTalkPanelProps) {
  const [talkState, setTalkState] = useState<TalkState>("connecting");
  const [muted, setMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0.2);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showStatus, setShowStatus] = useState(false);

  const mountedRef = useRef(true);
  const mutedRef = useRef(false);
  const talkStateRef = useRef<TalkState>("connecting");
  const sessionRef = useRef<Session | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const playbackSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const playbackTimeRef = useRef(0);

  useEffect(() => {
    talkStateRef.current = talkState;
  }, [talkState]);

  const stopPlayback = useCallback(() => {
    playbackSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // A source can already be finished.
      }
    });
    playbackSourcesRef.current = [];
    playbackTimeRef.current = 0;
  }, []);

  const stopCapture = useCallback(() => {
    cancelAnimationFrame(animationFrameRef.current);
    processorRef.current?.disconnect();
    analyserRef.current?.disconnect();
    processorRef.current = null;
    analyserRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    void inputContextRef.current?.close().catch(() => {});
    inputContextRef.current = null;
  }, []);

  const stopSession = useCallback((nextState: TalkState = "ended") => {
    stopCapture();
    stopPlayback();
    try {
      sessionRef.current?.close();
    } catch {
      // Closing a finished WebSocket is safe to ignore.
    }
    sessionRef.current = null;
    void outputContextRef.current?.close().catch(() => {});
    outputContextRef.current = null;
    if (mountedRef.current) setTalkState(nextState);
  }, [stopCapture, stopPlayback]);

  const enqueueAudio = useCallback(async (base64: string) => {
    try {
      const samples = decodePcm16(base64);
      if (samples.length === 0) return;
      if (!outputContextRef.current) outputContextRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      const context = outputContextRef.current;
      if (context.state === "suspended") await context.resume();

      const buffer = context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
      buffer.copyToChannel(samples, 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const startAt = Math.max(context.currentTime + 0.04, playbackTimeRef.current);
      source.start(startAt);
      playbackTimeRef.current = startAt + buffer.duration;
      playbackSourcesRef.current.push(source);
      source.onended = () => {
        playbackSourcesRef.current = playbackSourcesRef.current.filter((candidate) => candidate !== source);
        if (playbackSourcesRef.current.length === 0 && mountedRef.current && !mutedRef.current) setTalkState("listening");
      };
      if (mountedRef.current) setTalkState("speaking");
    } catch {
      if (mountedRef.current) {
        setErrorMessage("Voice playback could not continue. Please retry Live Talk.");
        setTalkState("error");
      }
    }
  }, []);

  const beginCapture = useCallback(async () => {
    if (mediaStreamRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    mediaStreamRef.current = stream;

    const context = new AudioContext();
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
    analyserRef.current = analyser;
    processorRef.current = processor;

    processor.onaudioprocess = (event) => {
      if (mutedRef.current || !sessionRef.current) return;
      const input = event.inputBuffer.getChannelData(0);
      try {
        sessionRef.current.sendRealtimeInput({
          audio: {
            data: encodeBase64(pcm16Buffer(input, context.sampleRate, INPUT_SAMPLE_RATE)),
            mimeType: "audio/pcm;rate=16000",
          },
        });
      } catch {
        // Socket state is surfaced by the connection callbacks below.
      }
    };

    const levels = new Uint8Array(analyser.frequencyBinCount);
    const renderLevels = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(levels);
      let sum = 0;
      for (const value of levels) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }
      const level = Math.sqrt(sum / levels.length);
      if (mountedRef.current) setAudioLevel(Math.max(0.05, Math.min(1, level * 7)));
      animationFrameRef.current = requestAnimationFrame(renderLevels);
    };
    renderLevels();
  }, []);

  const start = useCallback(async () => {
    stopSession("connecting");
    setErrorMessage(null);
    setTalkState("connecting");

    try {
      const tokenResponse = await authenticatedFetch("/api/gemini-live/token", {
        method: "POST",
        cache: "no-store",
      });
      const tokenPayload = await tokenResponse.json().catch(() => ({})) as Partial<TokenPayload> & { error?: string };
      if (!tokenResponse.ok || !tokenPayload.token || !tokenPayload.model) {
        throw new Error(tokenPayload.error ?? "Gemini Live could not start.");
      }

      const client = new GoogleGenAI({ apiKey: tokenPayload.token });
      const session = await client.live.connect({
        model: tokenPayload.model,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onopen: () => {
            if (mountedRef.current) setTalkState(mutedRef.current ? "ended" : "listening");
          },
          onmessage: (message) => {
            const liveMessage = message as LiveMessage;
            if (liveMessage.serverContent?.interrupted) {
              stopPlayback();
              if (mountedRef.current && !mutedRef.current) setTalkState("listening");
            }
            for (const part of liveMessage.serverContent?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) void enqueueAudio(part.inlineData.data);
            }
            if (liveMessage.serverContent?.turnComplete && playbackSourcesRef.current.length === 0 && mountedRef.current && !mutedRef.current) {
              setTalkState("listening");
            }
          },
          onerror: () => {
            if (mountedRef.current) {
              setErrorMessage("Gemini Live returned a connection error. Check the saved Gemini Live API key or model access, then retry.");
              setTalkState("error");
            }
          },
          onclose: () => {
            if (mountedRef.current && talkStateRef.current !== "ended" && talkStateRef.current !== "error") setTalkState("ended");
          },
        },
      });
      sessionRef.current = session;
      await beginCapture();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Gemini Live could not start.";
      if (mountedRef.current) {
        setErrorMessage(message);
        setTalkState("error");
      }
      stopCapture();
    }
  }, [beginCapture, enqueueAudio, stopCapture, stopPlayback, stopSession]);

  useEffect(() => {
    void start();
    return () => {
      mountedRef.current = false;
      stopSession("ended");
    };
  }, [start, stopSession]);

  const handleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) {
      stopPlayback();
      setTalkState("ended");
    } else if (sessionRef.current) {
      setTalkState("listening");
    }
  };

  const handleEnd = () => {
    stopSession("ended");
    onClose();
  };

  const isConnected = talkState === "listening" || talkState === "speaking";
  const isError = talkState === "error";

  return (
    <section className="fixed inset-0 z-[100] overflow-y-auto bg-[#050615] text-white" aria-label="Gemini Live Talk">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[18%] h-80 w-80 -translate-x-1/2 rounded-full bg-violet-600/20 blur-[100px]" />
        <div className="absolute bottom-[-8rem] right-[-5rem] h-72 w-72 rounded-full bg-indigo-500/10 blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-5 pb-7 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <button onClick={handleEnd} className="grid h-10 w-10 place-items-center rounded-full text-white/90 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-violet-400" aria-label="Back to chat">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <AudioLines className="h-5 w-5 text-violet-400" />
            <span>Live Talk</span>
          </div>
          <button onClick={() => setShowStatus((value) => !value)} className="grid h-10 w-10 place-items-center rounded-full text-white/75 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-violet-400" aria-label="Show Live Talk connection status">
            <EllipsisVertical className="h-5 w-5" />
          </button>
        </header>

        {showStatus && (
          <div className="absolute right-5 top-16 z-20 w-56 rounded-2xl border border-violet-300/20 bg-[#121329]/95 p-3 text-xs text-white/75 shadow-2xl backdrop-blur-xl">
            <p className="font-semibold text-white">Gemini Live</p>
            <p className="mt-1 leading-5">This panel calls only the saved Gemini Live API key through a protected connection.</p>
          </div>
        )}

        <div className="mt-10 flex items-center justify-center">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${isError ? "border-red-400/40 bg-red-500/15 text-red-200" : "border-pink-400/30 bg-pink-500/15 text-pink-100"}`}>
            <span className={`h-2 w-2 rounded-full ${isError ? "bg-red-400" : "animate-pulse bg-pink-400"}`} />
            {isError ? "Connection issue" : "Live Session"}
          </span>
        </div>

        <main className="flex flex-1 flex-col items-center justify-center py-12">
          <div className={`relative grid h-44 w-44 place-items-center rounded-full border transition-all duration-300 ${isError ? "border-red-400/40 bg-red-500/10 shadow-[0_0_70px_rgba(248,113,113,0.18)]" : "border-violet-400/35 bg-violet-600/10 shadow-[0_0_80px_rgba(124,58,237,0.35)]"}`}>
            <span className={`absolute inset-4 rounded-full border ${isError ? "border-red-300/30" : "border-violet-400/35"}`} />
            <span className={`absolute inset-9 rounded-full ${isError ? "bg-red-500/15" : "bg-violet-500/15"}`} />
            <span className={`relative grid h-20 w-20 place-items-center rounded-full border shadow-xl ${isError ? "border-red-300/60 bg-red-500/80" : "border-violet-300/70 bg-gradient-to-br from-violet-400 to-indigo-700"}`}>
              {muted ? <MicOff className="h-9 w-9" /> : <Mic className="h-9 w-9" />}
            </span>
          </div>

          <h1 className="mt-10 text-2xl font-semibold tracking-tight">{messageForState(talkState)}</h1>
          <div className="mt-6 flex h-16 items-center justify-center gap-1.5" aria-hidden="true">
            {Array.from({ length: WAVE_COUNT }, (_, index) => {
              const height = BAR_HEIGHTS[index] ?? 24;
              const multiplier = talkState === "speaking" ? 1.15 : audioLevel;
              return <span key={index} className={`w-1 rounded-full transition-[height,background-color] duration-150 ${isError ? "bg-red-400/65" : "bg-violet-400"}`} style={{ height: `${Math.max(5, height * multiplier)}px` }} />;
            })}
          </div>

          {isError ? (
            <div role="alert" className="mt-6 w-full max-w-sm rounded-2xl border border-red-400/45 bg-red-950/45 p-4 text-center shadow-[0_0_30px_rgba(239,68,68,0.14)]">
              <p className="text-sm font-semibold text-red-100">Gemini Live error</p>
              <p className="mt-1 text-xs leading-5 text-red-200/90">{errorMessage}</p>
              <button onClick={() => void start()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-400 active:scale-95">
                <RotateCcw className="h-3.5 w-3.5" /> Retry connection
              </button>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-violet-400/15 bg-violet-500/[0.08] px-4 py-3 text-center text-sm text-violet-100/90">
              <Sparkles className="mr-2 inline h-4 w-4 text-violet-300" /> Speak naturally, I&apos;m listening…
            </div>
          )}
        </main>

        <footer className="space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${muted ? "border-white/15 bg-white/5 text-white/50" : "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"}`}><span className={`h-2 w-2 rounded-full ${muted ? "bg-white/35" : "bg-emerald-400"}`} /> Microphone {muted ? "Muted" : "Active"}</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${isConnected ? "border-violet-300/25 bg-violet-500/10 text-violet-100" : "border-white/15 bg-white/5 text-white/55"}`}><Wifi className="h-3.5 w-3.5" /> {isConnected ? "Connected" : "Connecting"}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/75"><Volume2 className="h-3.5 w-3.5" /> Gemini Live</span>
          </div>
          <div className="flex gap-3">
            <button onClick={handleMute} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]">
              {muted ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              {muted ? "Unmute" : "Mute"}
            </button>
            <button onClick={handleEnd} className="flex h-12 flex-[1.35] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-red-500 text-sm font-bold text-white shadow-[0_12px_35px_rgba(239,68,68,0.3)] transition hover:from-rose-500 hover:to-red-400 active:scale-[0.98]">
              <CircleStop className="h-4 w-4" /> End Talk
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}
