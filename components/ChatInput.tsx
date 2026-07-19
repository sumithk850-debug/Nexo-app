"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Menu, Mic, Plus, Square, X, Paperclip } from "lucide-react";
import { ModelSelectorChip } from "./ModelSelectorChip";
import type { NexoModelId } from "@/lib/models";

const WAVE_BAR_COUNT = 24;
const WAVE_MIN_HEIGHT = 4;
const WAVE_MAX_HEIGHT = 32;

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  onOpenSidebar,
  selectedModel,
  onSelectModel,
  unlockedTiers,
  onAttach,
  attachedFile,
  onRemoveAttach,
  isStreaming,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  onOpenSidebar?: () => void;
  selectedModel: NexoModelId;
  onSelectModel: (id: NexoModelId) => void;
  unlockedTiers?: string[];
  onAttach: (file: File) => void;
  attachedFile?: File | null;
  onRemoveAttach?: () => void;
  isStreaming?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isListening, setIsListening] = useState(false);
  const [waveLevels, setWaveLevels] = useState<number[]>(
    Array(WAVE_BAR_COUNT).fill(WAVE_MIN_HEIGHT)
  );
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  function stopListening() {
    setIsListening(false);
    cancelAnimationFrame(rafRef.current);
    try {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    } catch {
      // recognition may already be stopped
    }
    recognitionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setWaveLevels(Array(WAVE_BAR_COUNT).fill(WAVE_MIN_HEIGHT));
  }

  async function startListening() {
    if (isListening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      function tick() {
        if (!audioCtxRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const bars = Array.from({ length: WAVE_BAR_COUNT }, (_, i) => {
          const idx = Math.floor((i / WAVE_BAR_COUNT) * dataArray.length);
          const magnitude = dataArray[idx] / 255;
          return Math.max(WAVE_MIN_HEIGHT, magnitude * WAVE_MAX_HEIGHT);
        });
        setWaveLevels(bars);
        rafRef.current = requestAnimationFrame(tick);
      }
      tick();

      const SpeechRecognitionCtor =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognitionCtor) {
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        let finalTranscript = "";
        recognition.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + " ";
            } else {
              interim += transcript;
            }
          }
          const currentText = (finalTranscript + interim).trim();
          if (currentText) {
            onChange(currentText);
          }
        };
        recognition.onerror = (e: any) => {
          console.error("Speech recognition error", e);
          stopListening();
        };
        recognition.onend = () => {
          if (isListening) {
            try {
              recognition.start();
            } catch {
              setIsListening(false);
            }
          }
        };
        recognition.start();
        recognitionRef.current = recognition;
      }

      setIsListening(true);
    } catch (err) {
      console.error("Mic access error", err);
    }
  }

  function handleMicClick() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  useEffect(() => {
    return () => stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((value.trim() || attachedFile) && !disabled) onSend();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onAttach(file);
    e.target.value = "";
  }

  return (
    <div className="px-4 py-2">
      <div className="mx-auto max-w-3xl">
        <div className="relative rounded-2xl border border-edge bg-panel px-3 pb-2.5 pt-3 shadow-sm focus-within:border-cyan/50 transition-all duration-300">
          
          {attachedFile && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-void/50 p-2 animate-fade-up">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan/10 text-cyan">
                <Paperclip className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-bold text-ink">{attachedFile.name}</p>
                <p className="text-[10px] text-ink-faint uppercase">{(attachedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button 
                onClick={onRemoveAttach}
                className="p-1 text-ink-faint hover:text-red-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {isListening ? (
            <div className="flex h-[38px] items-center justify-center gap-[4px] px-1 py-1">
              {waveLevels.map((height, i) => (
                <span
                  key={i}
                  className="w-[3px] flex-shrink-0 rounded-full bg-cyan shadow-[0_0_10px_rgba(0,229,255,0.5)] transition-[height] duration-75"
                  style={{ height: `${height}px` }}
                />
              ))}
            </div>
          ) : (
            <textarea
              ref={ref}
              rows={1}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Chat with NEXO AI…"
              className="max-h-40 w-full resize-none bg-transparent px-1 py-1 text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none"
            />
          )}

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {onOpenSidebar && (
                <button
                  onClick={onOpenSidebar}
                  className="flex-shrink-0 text-ink-muted hover:text-ink md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.md,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-edge text-ink-muted transition hover:border-cyan/40 hover:text-ink"
                aria-label="Attach file"
              >
                <Plus className="h-4 w-4" />
              </button>

              <button
                onClick={handleMicClick}
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                  isListening
                    ? "border-cyan bg-cyan/10 text-cyan shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                    : "border-edge text-ink-muted hover:border-cyan/40 hover:text-ink"
                }`}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
                title={isListening ? "Stop" : "Speak"}
              >
                {isListening ? (
                  <Square className="h-3 w-3" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>

              <ModelSelectorChip
                selected={selectedModel}
                onSelect={onSelectModel}
                unlockedTiers={unlockedTiers || ["Free"]}
              />
            </div>

            <button
              onClick={onSend}
              disabled={disabled || (!value.trim() && !attachedFile) || isStreaming}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cyan text-void transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-30 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)] hover:scale-105 active:scale-95"
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
