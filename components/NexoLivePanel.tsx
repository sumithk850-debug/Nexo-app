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

type VoiceSessionResponse = {
  sessionId?: string;
  remainingSeconds?: number;
  maxDurationSeconds?: number;
  error?: string;
};

type NexoLivePanelProps = {
  onClose: () => void;
  onVoiceTurnComplete?: (assistantText: string) => void;
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

function readBlobAsBase64(blob: Blob) {
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

async function blobToVoicePayload(blob: Blob) {
  try {
    const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) throw new Error("Audio conversion is not supported.");
    const audioContext = new AudioContextConstructor();
    const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const channel = decoded.getChannelData(0);
    const buffer = new ArrayBuffer(44 + channel.length * 2);
    const view = new DataView(buffer);
    const write = (offset: number, value: string) => {
      [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
    };
    write(0, "RIFF");
    view.setUint32(4, 36 + channel.length * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, decoded.sampleRate, true);
    view.setUint32(28, decoded.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, channel.length * 2, true);
    for (let index = 0; index < channel.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, channel[index]));
      view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    await audioContext.close();
    return { audioData: await readBlobAsBase64(new Blob([buffer], { type: "audio/wav" })), mimeType: "audio/wav" };
  } catch {
    return { audioData: await readBlobAsBase64(blob), mimeType: blob.type || "audio/webm" };
  }
}

function preferredMaleVoice(text: string) {
  if (!("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return undefined;

  const isSinhala = /[\u0D80-\u0DFF]/.test(text);
  const languagePrefix = isSinhala ? "si" : "en";
  const languageVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(languagePrefix));
  const maleHint = /male|man|david|mark|daniel|alex|george|james|ryan|guy|ravi|kumar|suresh|nimal|kasun|chamara/i;
  return languageVoices.find((voice) => maleHint.test(`${voice.name} ${voice.voiceURI}`))
    ?? languageVoices[0]
    ?? voices.find((voice) => maleHint.test(`${voice.name} ${voice.voiceURI}`));
}

function stateLabel(state: VoiceState) {
  if (state === "listening") return "Listening…";
  if (state === "processing") return "Processing your voice…";
  if (state === "speaking") return "Nexo is speaking…";
  if (state === "error") return "Voice connection needs attention";
  return "Ready to talk";
}

export function NexoLivePanel({ onClose, onVoiceTurnComplete }: NexoLivePanelProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [muted, setMuted] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [maxRecordingSeconds, setMaxRecordingSeconds] = useState(60);
  const [audioLevel, setAudioLevel] = useState(0.22);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [showStatus, setShowStatus] = useState(false);

  const mountedRef = useRef(true);
  const mutedRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const analysisFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voiceTurnCompleteRef = useRef(onVoiceTurnComplete);
  const sessionIdRef = useRef<string | null>(null);
  const closingRef = useRef(false);
  const startingRef = useRef(false);
  const speechDetectedRef = useRef(false);
  const silenceStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    voiceTurnCompleteRef.current = onVoiceTurnComplete;
  }, [onVoiceTurnComplete]);

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const stopAudioMonitor = useCallback(() => {
    if (analysisFrameRef.current !== null) {
      window.cancelAnimationFrame(analysisFrameRef.current);
      analysisFrameRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0.22);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    speechRef.current = null;
  }, []);

  const resetAudioState = useCallback(() => {
    clearRecordingTimer();
    stopAudioMonitor();
    stopStream();
    recorderRef.current = null;
    setRecordingSeconds(0);
  }, [clearRecordingTimer, stopAudioMonitor, stopStream]);

  const cancelRemoteSession = useCallback((sessionId: string | null) => {
    if (!sessionId) return;
    void authenticatedFetch("/api/nexo/voice/session", {
      method: "DELETE",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  const submitRecording = useCallback(async (blob: Blob, sessionId: string, fallbackMimeType: string) => {
    if (blob.size === 0) {
      cancelRemoteSession(sessionId);
      if (mountedRef.current) {
        setErrorMessage("No voice was captured. Please try again.");
        setVoiceState("error");
      }
      return;
    }

    try {
      const { audioData, mimeType } = await blobToVoicePayload(blob);
      const response = await authenticatedFetch("/api/nexo/voice", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioData, mimeType: mimeType || fallbackMimeType || "audio/wav", sessionId }),
      });
      const payload = await response.json().catch(() => ({})) as VoiceResponse;
      if (!response.ok || !payload.text) throw new Error(payload.error ?? "Nexo could not complete that voice turn.");
      if (!mountedRef.current) return;

      setResponseText(payload.text);
      setErrorMessage(null);
      voiceTurnCompleteRef.current?.(payload.text);
      setVoiceState("speaking");
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(payload.text);
        const voice = preferredMaleVoice(payload.text);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = /[\u0D80-\u0DFF]/.test(payload.text) ? "si-LK" : "en-US";
        }
        utterance.rate = 0.96;
        utterance.pitch = 0.84;
        utterance.volume = 1;
        utterance.onend = () => {
          if (mountedRef.current) setVoiceState("idle");
        };
        utterance.onerror = () => {
          if (mountedRef.current) setVoiceState("idle");
        };
        speechRef.current = utterance;
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } else {
        setVoiceState("idle");
      }
    } catch (cause) {
      cancelRemoteSession(sessionId);
      if (mountedRef.current) {
        setErrorMessage(cause instanceof Error ? cause.message : "Nexo could not complete that voice turn.");
        setVoiceState("error");
      }
    }
  }, [cancelRemoteSession]);

  const stopRecording = useCallback(() => {
    clearRecordingTimer();
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, [clearRecordingTimer]);

  const startRecording = useCallback(async () => {
    if (startingRef.current || sessionIdRef.current || recorderRef.current) return;
    startingRef.current = true;
    closingRef.current = false;
    setErrorMessage(null);
    setResponseText("");
    stopSpeech();

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Microphone recording is not supported on this device.");
      }

      const sessionResponse = await authenticatedFetch("/api/nexo/voice/session", {
        method: "POST",
        cache: "no-store",
      });
      const sessionPayload = await sessionResponse.json().catch(() => ({})) as VoiceSessionResponse;
      if (!sessionResponse.ok || !sessionPayload.sessionId) {
        throw new Error(sessionPayload.error ?? "Voice session could not start. Please retry.");
      }
      sessionIdRef.current = sessionPayload.sessionId;
      const allowedSeconds = Math.max(1, Math.min(60, Math.floor(sessionPayload.maxDurationSeconds ?? 60)));
      setMaxRecordingSeconds(allowedSeconds);

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
        cancelRemoteSession(sessionIdRef.current);
        sessionIdRef.current = null;
        return;
      }

      const mimeType = chooseRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      speechDetectedRef.current = false;
      silenceStartedAtRef.current = null;
      setVoiceState("listening");

      const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextConstructor) {
        const audioContext = new AudioContextConstructor();
        await audioContext.resume().catch(() => {});
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.68;
        source.connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        audioContextRef.current = audioContext;
        const animateWaveform = () => {
          if (audioContextRef.current !== audioContext) return;
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) {
            const normalized = (sample - 128) / 128;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / samples.length);
          const now = Date.now();
          const elapsed = now - recordingStartedAtRef.current;
          const userIsSpeaking = rms > 0.035;
          if (userIsSpeaking) {
            speechDetectedRef.current = true;
            silenceStartedAtRef.current = null;
          } else if (speechDetectedRef.current && elapsed > 650) {
            silenceStartedAtRef.current ??= now;
            if (now - silenceStartedAtRef.current >= 850) {
              stopRecording();
              return;
            }
          }
          setAudioLevel(Math.max(0.14, Math.min(1, 0.14 + rms * 5.2)));
          analysisFrameRef.current = window.requestAnimationFrame(animateWaveform);
        };
        animateWaveform();
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        const activeSession = sessionIdRef.current;
        sessionIdRef.current = null;
        cancelRemoteSession(activeSession);
        resetAudioState();
        if (mountedRef.current) {
          setErrorMessage("Microphone recording stopped unexpectedly. Please retry.");
          setVoiceState("error");
        }
      };
      recorder.onstop = () => {
        const recordedMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: recordedMimeType });
        const shouldDiscard = closingRef.current;
        const activeSession = sessionIdRef.current;
        sessionIdRef.current = null;
        resetAudioState();
        if (shouldDiscard) return;
        if (!activeSession) {
          if (mountedRef.current) {
            setErrorMessage("The voice session expired. Please retry.");
            setVoiceState("error");
          }
          return;
        }
        if (mountedRef.current) setVoiceState("processing");
        void submitRecording(blob, activeSession, recordedMimeType);
      };
      recorder.start(200);
      recordingTimerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - recordingStartedAtRef.current;
        setRecordingSeconds(Math.min(allowedSeconds, Math.floor(elapsed / 1_000)));
        if (elapsed >= allowedSeconds * 1_000) stopRecording();
      }, 120);
    } catch (cause) {
      const activeSession = sessionIdRef.current;
      sessionIdRef.current = null;
      cancelRemoteSession(activeSession);
      resetAudioState();
      if (mountedRef.current) {
        setErrorMessage(cause instanceof Error ? cause.message : "Microphone access was not available.");
        setVoiceState("error");
      }
    } finally {
      startingRef.current = false;
    }
  }, [cancelRemoteSession, resetAudioState, stopRecording, stopSpeech, submitRecording]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      closingRef.current = true;
      clearRecordingTimer();
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      } catch {
        // The recorder may already be closed by the browser.
      }
      const activeSession = sessionIdRef.current;
      sessionIdRef.current = null;
      cancelRemoteSession(activeSession);
      stopAudioMonitor();
      stopStream();
      stopSpeech();
    };
  }, [cancelRemoteSession, clearRecordingTimer, stopAudioMonitor, stopSpeech, stopStream]);

  useEffect(() => {
    const autoStartTimer = window.setTimeout(() => {
      if (mountedRef.current && voiceState === "idle") void startRecording();
    }, 180);
    return () => window.clearTimeout(autoStartTimer);
  }, [startRecording, voiceState]);

  const handleMic = () => {
    if (voiceState === "listening") {
      stopRecording();
      return;
    }
    if (voiceState === "processing" || voiceState === "speaking") return;
    void startRecording();
  };

  const handleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) {
      stopSpeech();
      if (voiceState === "speaking") setVoiceState("idle");
    }
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setVoiceState("idle");
  };

  const handleEnd = () => {
    closingRef.current = true;
    if (voiceState === "listening") stopRecording();
    const activeSession = sessionIdRef.current;
    sessionIdRef.current = null;
    cancelRemoteSession(activeSession);
    resetAudioState();
    stopSpeech();
    onClose();
  };

  const isError = voiceState === "error";
  const isConnected = voiceState === "listening" || voiceState === "processing" || voiceState === "speaking";
  const isBusy = voiceState === "processing" || voiceState === "speaking";
  const maxWaveHeight = Math.max(1, maxRecordingSeconds);

  return (
    <section className="fixed inset-0 z-[100] overflow-y-auto bg-[#050615] text-white" aria-label="NEXO Live">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute left-1/2 top-[18%] h-80 w-80 -translate-x-1/2 rounded-full blur-[100px] transition-colors duration-500 ${isError ? "bg-red-600/20" : "bg-violet-600/20"}`} />
        <div className="absolute bottom-[-8rem] right-[-5rem] h-72 w-72 rounded-full bg-indigo-500/10 blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-5 pb-7 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <button onClick={handleEnd} className="grid h-10 w-10 place-items-center rounded-full text-white/90 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-violet-400" aria-label="Back to chat"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex items-center gap-2 text-base font-semibold tracking-tight"><AudioLines className="h-5 w-5 text-violet-400" /><span>NEXO Live</span></div>
          <button onClick={() => setShowStatus((value) => !value)} className="grid h-10 w-10 place-items-center rounded-full text-white/75 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-violet-400" aria-label="Show voice session status"><EllipsisVertical className="h-5 w-5" /></button>
        </header>

        {showStatus && (
          <div className="absolute right-5 top-16 z-20 w-56 rounded-2xl border border-violet-300/20 bg-[#121329]/95 p-3 text-xs text-white/75 shadow-2xl backdrop-blur-xl">
            <p className="font-semibold text-white">NEXO Live</p>
            <p className="mt-1 leading-5">Speak naturally, then tap the microphone to send your voice message.</p>
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
          {voiceState === "listening" && <p className="mt-2 text-xs text-white/55">Recording · {recordingSeconds}s / {maxWaveHeight}s</p>}
          <div className="mt-6 flex h-16 items-center justify-center gap-1.5" aria-hidden="true">
            {WAVE_HEIGHTS.map((height, index) => {
              const liveMultiplier = voiceState === "listening" ? audioLevel : voiceState === "speaking" ? 0.82 + ((index % 3) * 0.12) : 0.5;
              return <span key={index} className={`w-1 rounded-full transition-[height,background-color] duration-100 ${isError ? "bg-red-400/65" : "bg-violet-400"}`} style={{ height: `${Math.max(5, height * liveMultiplier)}px` }} />;
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

          {!responseText && !isError && voiceState !== "listening" && <div className="mt-5 rounded-2xl border border-violet-400/15 bg-violet-500/[0.08] px-4 py-3 text-center text-sm text-violet-100/90"><Sparkles className="mr-2 inline h-4 w-4 text-violet-300" /> Speak naturally — the microphone starts automatically…</div>}
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
