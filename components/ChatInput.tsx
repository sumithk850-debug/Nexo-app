"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { ArrowUp, Menu, Mic, Plus, Square, X, Paperclip } from "lucide-react";
import { ModelSelectorChip } from "./ModelSelectorChip";
import type { NexoModelId } from "@/lib/models";

const WAVE_BAR_COUNT = 24;
const WAVE_MIN_HEIGHT = 4;
const WAVE_MAX_HEIGHT = 32;

// GitHub's classic and fine-grained token prefixes. Detection happens only in
// the client input so a matching secret never enters message state or reaches
// the model/chat API.
function extractGithubPersonalAccessToken(value: string): string | null {
  return value.match(/(?:github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,})/)?.[0] ?? null;
}

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
  attachedFiles = [],
  onRemoveAttach,
  isStreaming,
  onStop,
  streamElapsedSeconds = 0,
  onSecretDetected,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  onOpenSidebar?: () => void;
  selectedModel: NexoModelId;
  onSelectModel: (id: NexoModelId) => void;
  unlockedTiers?: string[];
  onAttach: (files: File[]) => void;
  attachedFiles?: File[];
  onRemoveAttach?: (index: number) => void;
  isStreaming?: boolean;
  onStop?: () => void;
  streamElapsedSeconds?: number;
  onSecretDetected?: (secret: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isListening, setIsListening] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
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

  useEffect(() => {
    const objectUrls = attachedFiles
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => URL.createObjectURL(file));
    setImagePreviews(objectUrls);
    return () => objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [attachedFiles]);

  function interceptSecret(): boolean {
    const secret = extractGithubPersonalAccessToken(value);
    if (!secret) return false;
    onChange("");
    onSecretDetected?.(secret);
    return true;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((value.trim() || attachedFiles.length > 0) && !disabled && !interceptSecret()) onSend();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const pastedText = e.clipboardData.getData("text");
    const secret = extractGithubPersonalAccessToken(pastedText);
    if (!secret) return;
    e.preventDefault();
    onChange("");
    onSecretDetected?.(secret);
  }

  function handleSendClick() {
    if (!interceptSecret()) onSend();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onAttach(files);
    e.target.value = "";
  }

  return (
    <div className="px-4 py-2">
      <div className="mx-auto max-w-3xl">
        <div className="relative rounded-2xl border border-edge bg-panel px-3 pb-2.5 pt-3 shadow-sm focus-within:border-cyan/50 transition-all duration-300">
          
          {attachedFiles.length > 0 && (
            <div className="mb-2 flex items-center gap-2 overflow-x-auto rounded-lg bg-void/50 p-2 animate-fade-up custom-scrollbar">
              {attachedFiles.map((file, index) => {
                const imageIndex = attachedFiles.slice(0, index).filter((candidate) => candidate.type.startsWith("image/")).length;
                const imagePreview = file.type.startsWith("image/") ? imagePreviews[imageIndex] : undefined;
                return (
                  <div key={`${file.name}-${index}`} className="relative flex min-w-[76px] max-w-[112px] flex-col gap-1 rounded-md border border-edge bg-panel/70 p-1.5">
                    {imagePreview ? (
                      <Image src={imagePreview} alt={`Attached image preview: ${file.name}`} width={84} height={56} unoptimized className="h-14 w-full rounded object-cover" />
                    ) : (
                      <div className="flex h-14 items-center justify-center rounded bg-cyan/10 text-cyan"><Paperclip className="h-4 w-4" /></div>
                    )}
                    <p className="truncate text-[10px] font-bold text-ink" title={file.name}>{file.name}</p>
                    <p className="text-[9px] uppercase text-ink-faint">{file.type === "application/pdf" ? "PDF analysis" : "Image ready"}</p>
                    <button onClick={() => onRemoveAttach?.(index)} className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-edge bg-panel text-ink-faint hover:text-red-400" aria-label={`Remove ${file.name}`}><X className="h-3 w-3" /></button>
                  </div>
                );
              })}
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
              onPaste={handlePaste}
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
                accept="image/*,application/pdf"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-edge text-ink-muted transition hover:border-cyan/40 hover:text-ink"
                aria-label="Attach image or file"
                title="Attach image or file"
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
              onClick={isStreaming ? onStop : handleSendClick}
              disabled={isStreaming ? !onStop : disabled || (!value.trim() && attachedFiles.length === 0)}
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-30 hover:scale-105 active:scale-95 ${
                isStreaming
                  ? "bg-rose-500 text-white hover:bg-rose-400 hover:shadow-[0_0_15px_rgba(244,63,94,0.35)]"
                  : "bg-cyan text-void hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]"
              }`}
              aria-label={isStreaming ? `Stop generating after ${streamElapsedSeconds} seconds` : "Send message"}
              title={isStreaming ? "Stop generating" : "Send message"}
            >
              {isStreaming ? <Square className="h-3.5 w-3.5 fill-current" /> : <ArrowUp className="h-4 w-4" strokeWidth={3} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
