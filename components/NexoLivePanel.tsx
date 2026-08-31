"use client";

import { ArrowLeft, AudioLines, CircleStop, EllipsisVertical, Mic, MicOff, RotateCcw, Sparkles, Volume2, Wifi } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/authFetch";

type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";
type VoiceResponse = { text?: string; error?: string; audioData?: string; audioMimeType?: string; voiceProvider?: "voice" | "browser-fallback" };
type VoiceSessionResponse = { sessionId?: string; maxDurationSeconds?: number; error?: string };
type Props = { onClose: () => void; onVoiceTurnComplete?: (assistantText: string) => void };

const WAVES = [14,23,34,19,43,28,52,22,37,58,31,20,45,27,62,35,18,48,30,54,25,40,20,49,34,22,43,29,55,17];
const MIN_SPEECH_MS = 1000;
const END_OF_TURN_SILENCE_MS = 1800;
const SILENCE_CHECK_GRACE_MS = 900;

function mimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function base64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => { const v = typeof r.result === "string" ? r.result : ""; resolve(v.includes(",") ? v.slice(v.indexOf(",") + 1) : v); };
    r.onerror = () => reject(new Error("Voice recording could not be read."));
    r.readAsDataURL(blob);
  });
}

async function toWav(blob: Blob) {
  try {
    const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) throw new Error("Audio conversion unavailable");
    const ctx = new AC();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const samples = decoded.getChannelData(0);
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const write = (o: number, s: string) => [...s].forEach((c,i) => view.setUint8(o+i,c.charCodeAt(0)));
    write(0,"RIFF"); view.setUint32(4,36+samples.length*2,true); write(8,"WAVE"); write(12,"fmt ");
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,decoded.sampleRate,true);
    view.setUint32(28,decoded.sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true); write(36,"data"); view.setUint32(40,samples.length*2,true);
    for(let i=0;i<samples.length;i++){const s=Math.max(-1,Math.min(1,samples[i]));view.setInt16(44+i*2,s<0?s*0x8000:s*0x7fff,true);}
    await ctx.close();
    return { audioData: await base64(new Blob([buffer],{type:"audio/wav"})), mimeType:"audio/wav" };
  } catch { return { audioData: await base64(blob), mimeType: blob.type || "audio/webm" }; }
}

function browserVoice(text:string){
  if (!("speechSynthesis" in window)) return undefined;
  const voices=window.speechSynthesis.getVoices(); const si=/[\u0D80-\u0DFF]/.test(text);
  return voices.find(v=>v.lang.toLowerCase().startsWith(si?"si":"en")) ?? voices[0];
}

export function NexoLivePanel({ onClose, onVoiceTurnComplete }: Props) {
  const [state,setState]=useState<VoiceState>("idle"); const [muted,setMuted]=useState(false); const [seconds,setSeconds]=useState(0); const [maxSeconds,setMaxSeconds]=useState(60);
  const [level,setLevel]=useState(.22); const [error,setError]=useState<string|null>(null); const [responseText,setResponseText]=useState(""); const [status,setStatus]=useState(false); const [provider,setProvider]=useState<string|null>(null);
  const mounted=useRef(true); const mutedRef=useRef(false); const recorder=useRef<MediaRecorder|null>(null); const stream=useRef<MediaStream|null>(null); const chunks=useRef<Blob[]>([]);
  const timer=useRef<number|null>(null); const frame=useRef<number|null>(null); const ctx=useRef<AudioContext|null>(null); const audio=useRef<HTMLAudioElement|null>(null); const audioUrl=useRef<string|null>(null); const speech=useRef<SpeechSynthesisUtterance|null>(null);
  const session=useRef<string|null>(null); const closing=useRef(false); const starting=useRef(false); const startedAt=useRef(0); const heard=useRef(false); const silenceAt=useRef<number|null>(null); const turnRef=useRef(onVoiceTurnComplete);
  useEffect(()=>{turnRef.current=onVoiceTurnComplete},[onVoiceTurnComplete]);

  const clearTimer=useCallback(()=>{if(timer.current!==null){clearInterval(timer.current);timer.current=null}},[]);
  const stopMonitor=useCallback(()=>{if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null} if(ctx.current){void ctx.current.close().catch(()=>{});ctx.current=null} setLevel(.22)},[]);
  const stopStream=useCallback(()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null},[]);
  const stopSpeech=useCallback(()=>{if("speechSynthesis" in window) window.speechSynthesis.cancel();speech.current=null;if(audio.current){audio.current.pause();audio.current=null}if(audioUrl.current){URL.revokeObjectURL(audioUrl.current);audioUrl.current=null}},[]);
  const reset=useCallback(()=>{clearTimer();stopMonitor();stopStream();recorder.current=null;setSeconds(0)},[clearTimer,stopMonitor,stopStream]);
  const cancelSession=useCallback((id:string|null)=>{if(id) void authenticatedFetch("/api/nexo/voice/session",{method:"DELETE",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:id}),keepalive:true}).catch(()=>{})},[]);

  const fallbackSpeech=useCallback((text:string)=>{if(!( "speechSynthesis" in window)){setState("idle");return}const u=new SpeechSynthesisUtterance(text);const v=browserVoice(text);if(v){u.voice=v;u.lang=v.lang}else u.lang=/[\u0D80-\u0DFF]/.test(text)?"si-LK":"en-US";u.rate=.96;u.pitch=.92;u.onend=()=>mounted.current&&setState("idle");u.onerror=()=>mounted.current&&setState("idle");speech.current=u;window.speechSynthesis.cancel();window.speechSynthesis.speak(u)},[]);
  const playGemini=useCallback(async(data:string,type:string,text:string)=>{stopSpeech();const r=await fetch(`data:${type};base64,${data}`);const b=await r.blob();const url=URL.createObjectURL(b);const a=new Audio(url);audio.current=a;audioUrl.current=url;a.onended=()=>{if(audioUrl.current===url){URL.revokeObjectURL(url);audioUrl.current=null;audio.current=null}if(mounted.current)setState("idle")};a.onerror=()=>{if(audioUrl.current===url){URL.revokeObjectURL(url);audioUrl.current=null;audio.current=null}if(mounted.current){setProvider("browser-fallback");fallbackSpeech(text)}};await a.play()},[fallbackSpeech,stopSpeech]);

  const submit=useCallback(async(blob:Blob,id:string,fallbackMime:string)=>{if(!blob.size){cancelSession(id);setError("No voice was captured. Please try again.");setState("error");return}try{const p=await toWav(blob);const r=await authenticatedFetch("/api/nexo/voice",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({audioData:p.audioData,mimeType:p.mimeType||fallbackMime||"audio/wav",sessionId:id})});const data=await r.json().catch(()=>({})) as VoiceResponse;if(!r.ok||!data.text)throw new Error(data.error??"Nexo could not complete that voice turn.");if(!mounted.current)return;setResponseText(data.text);setError(null);setProvider(data.voiceProvider??"browser-fallback");turnRef.current?.(data.text);setState("speaking");if(!mutedRef.current&&data.audioData&&data.audioMimeType){try{await playGemini(data.audioData,data.audioMimeType,data.text);return}catch(e){console.warn("NEXO voice playback failed; using browser fallback",e);setProvider("browser-fallback")}}if(!mutedRef.current)fallbackSpeech(data.text);else setState("idle")}catch(e){cancelSession(id);if(mounted.current){setError(e instanceof Error?e.message:"Nexo could not complete that voice turn.");setState("error")}}},[cancelSession,fallbackSpeech,playGemini]);

  const stopRecording=useCallback(()=>{clearTimer();if(recorder.current&&recorder.current.state!=="inactive")recorder.current.stop()},[clearTimer]);
  const start=useCallback(async()=>{if(starting.current||session.current||recorder.current)return;starting.current=true;closing.current=false;setError(null);setResponseText("");setProvider(null);stopSpeech();try{if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined")throw new Error("Microphone recording is not supported on this device.");const sr=await authenticatedFetch("/api/nexo/voice/session",{method:"POST",cache:"no-store"});const sp=await sr.json().catch(()=>({})) as VoiceSessionResponse;if(!sr.ok||!sp.sessionId)throw new Error(sp.error??"Voice session could not start. Please retry.");session.current=sp.sessionId;const allowed=Math.max(1,Math.min(60,Math.floor(sp.maxDurationSeconds??60)));setMaxSeconds(allowed);const ms=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});if(!mounted.current){ms.getTracks().forEach(t=>t.stop());cancelSession(session.current);session.current=null;return}const mt=mimeType();const rec=mt?new MediaRecorder(ms,{mimeType:mt}):new MediaRecorder(ms);stream.current=ms;recorder.current=rec;chunks.current=[];startedAt.current=Date.now();heard.current=false;silenceAt.current=null;setState("listening");const AC=window.AudioContext||(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(AC){const c=new AC();await c.resume().catch(()=>{});const src=c.createMediaStreamSource(ms);const an=c.createAnalyser();an.fftSize=128;an.smoothingTimeConstant=.68;src.connect(an);const samples=new Uint8Array(an.fftSize);ctx.current=c;const wave=()=>{if(ctx.current!==c)return;an.getByteTimeDomainData(samples);let sum=0;for(const x of samples){const n=(x-128)/128;sum+=n*n}const rms=Math.sqrt(sum/samples.length);const now=Date.now();const elapsed=now-startedAt.current;if(rms>.035){heard.current=true;silenceAt.current=null}else if(heard.current&&elapsed>=MIN_SPEECH_MS+SILENCE_CHECK_GRACE_MS){silenceAt.current??=now;if(now-silenceAt.current>=END_OF_TURN_SILENCE_MS){stopRecording();return}}setLevel(Math.max(.14,Math.min(1,.14+rms*5.2)));frame.current=requestAnimationFrame(wave)};wave()}rec.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};rec.onerror=()=>{const id=session.current;session.current=null;cancelSession(id);reset();setError("Microphone recording stopped unexpectedly. Please retry.");setState("error")};rec.onstop=()=>{const rm=rec.mimeType||mt||"audio/webm";const b=new Blob(chunks.current,{type:rm});const discard=closing.current;const id=session.current;session.current=null;reset();if(discard)return;if(!id){setError("The voice session expired. Please retry.");setState("error");return}setState("processing");void submit(b,id,rm)};rec.start(200);timer.current=window.setInterval(()=>{const e=Date.now()-startedAt.current;setSeconds(Math.min(allowed,Math.floor(e/1000)));if(e>=allowed*1000)stopRecording()},120)}catch(e){const id=session.current;session.current=null;cancelSession(id);reset();setError(e instanceof Error?e.message:"Microphone access was not available.");setState("error")}finally{starting.current=false}},[cancelSession,reset,stopRecording,stopSpeech,submit]);

  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;closing.current=true;clearTimer();try{if(recorder.current&&recorder.current.state!=="inactive")recorder.current.stop()}catch{}const id=session.current;session.current=null;cancelSession(id);stopMonitor();stopStream();stopSpeech()}},[cancelSession,clearTimer,stopMonitor,stopSpeech,stopStream]);
  useEffect(()=>{const t=window.setTimeout(()=>{if(mounted.current&&state==="idle")void start()},180);return()=>clearTimeout(t)},[start,state]);

  const mic=()=>{if(state==="listening")stopRecording();else if(state!=="processing"&&state!=="speaking")void start()};
  const mute=()=>{mutedRef.current=!mutedRef.current;setMuted(mutedRef.current);if(mutedRef.current){stopSpeech();if(state==="speaking")setState("idle")}};
  const retry=()=>{setError(null);setState("idle")};
  const end=()=>{closing.current=true;if(state==="listening")stopRecording();const id=session.current;session.current=null;cancelSession(id);reset();stopSpeech();onClose()};
  const isError=state==="error", connected=state!=="idle"&&state!=="error", busy=state==="processing"||state==="speaking";

  return <section className="fixed inset-0 z-[100] overflow-y-auto bg-[#050615] text-white" aria-label="NEXO Live"><div className="pointer-events-none absolute inset-0 overflow-hidden"><div className={`absolute left-1/2 top-[18%] h-80 w-80 -translate-x-1/2 rounded-full blur-[100px] ${isError?"bg-red-600/20":"bg-violet-600/20"}`}/><div className="absolute bottom-[-8rem] right-[-5rem] h-72 w-72 rounded-full bg-indigo-500/10 blur-[110px]"/></div><div className="relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-5 pb-7 pt-[max(1.5rem,env(safe-area-inset-top))]">
    <header className="flex items-center justify-between"><button onClick={end} className="grid h-10 w-10 place-items-center rounded-full text-white/90 hover:bg-white/10" aria-label="Back to chat"><ArrowLeft className="h-5 w-5"/></button><div className="flex items-center gap-2 text-base font-semibold"><AudioLines className="h-5 w-5 text-violet-400"/>NEXO Live</div><button onClick={()=>setStatus(v=>!v)} className="grid h-10 w-10 place-items-center rounded-full text-white/75 hover:bg-white/10" aria-label="Show voice status"><EllipsisVertical className="h-5 w-5"/></button></header>
    {status&&<div className="absolute right-5 top-16 z-20 w-60 rounded-2xl border border-violet-300/20 bg-[#121329]/95 p-3 text-xs text-white/75 shadow-2xl backdrop-blur-xl"><p className="font-semibold text-white">NEXO Live</p><p className="mt-1 leading-5">Natural, normal-length voice responses with automatic device fallback when needed.</p></div>}
    <div className="mt-10 flex justify-center"><span className="inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/15 px-3 py-1.5 text-xs font-semibold"><span className={`h-2 w-2 rounded-full ${isError?"bg-red-400":"animate-pulse bg-pink-400"}`}/>{isError?"Connection issue":"Live Session"}</span></div>
    <main className="flex flex-1 flex-col items-center justify-center py-12"><button onClick={mic} disabled={busy} className={`relative grid h-44 w-44 place-items-center rounded-full border ${isError?"border-red-400/40 bg-red-500/10":"border-violet-400/35 bg-violet-600/10 shadow-[0_0_80px_rgba(124,58,237,0.35)]"}`} aria-label={state==="listening"?"Stop recording":"Start recording"}><span className="absolute inset-4 rounded-full border border-violet-400/35"/><span className="absolute inset-9 rounded-full bg-violet-500/15"/><span className="relative grid h-20 w-20 place-items-center rounded-full border border-violet-300/70 bg-gradient-to-br from-violet-400 to-indigo-700 shadow-xl">{muted?<MicOff className="h-9 w-9"/>:<Mic className="h-9 w-9"/>}</span></button>
      <h1 className="mt-10 text-center text-2xl font-semibold">{state==="listening"?"Listening…":state==="processing"?"Thinking about your question…":state==="speaking"?"Nexo is speaking…":isError?"Voice connection needs attention":"Ready to talk"}</h1>{state==="listening"&&<p className="mt-2 text-xs text-white/55">Recording · {seconds}s / {maxSeconds}s</p>}
      <div className="mt-6 flex h-16 items-center justify-center gap-1.5" aria-hidden="true">{WAVES.map((h,i)=><span key={i} className={`w-1 rounded-full ${isError?"bg-red-400/65":"bg-violet-400"}`} style={{height:`${Math.max(5,h*(state==="listening"?level:state==="speaking"?.9:.5))}px`}}/>)}</div>
      {responseText&&!isError&&<div className="mt-5 w-full max-w-sm rounded-2xl border border-violet-300/20 bg-violet-500/[0.09] p-4 text-sm leading-6 text-violet-50"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-violet-200"><Sparkles className="h-4 w-4"/>Nexo response</div><p>{responseText}</p></div>}
      {isError&&<div role="alert" className="mt-6 w-full max-w-sm rounded-2xl border border-red-400/45 bg-red-950/45 p-4 text-center"><p className="text-sm font-semibold text-red-100">Voice connection error</p><p className="mt-1 text-xs leading-5 text-red-200/90">{error??"Nexo could not complete that voice turn. Please retry."}</p><button onClick={retry} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-xs font-bold"><RotateCcw className="h-3.5 w-3.5"/>Retry</button></div>}
      {!responseText&&!isError&&state!=="listening"&&<div className="mt-5 rounded-2xl border border-violet-400/15 bg-violet-500/[0.08] px-4 py-3 text-center text-sm text-violet-100/90"><Sparkles className="mr-2 inline h-4 w-4 text-violet-300"/>Speak naturally — the microphone starts automatically…</div>}
    </main>
    <footer className="space-y-4"><div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-100"><span className="h-2 w-2 rounded-full bg-emerald-400"/>Microphone {muted?"Muted":"Active"}</span><span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${connected?"border-violet-300/25 bg-violet-500/10 text-violet-100":"border-white/15 bg-white/5 text-white/55"}`}><Wifi className="h-3.5 w-3.5"/>{connected?"Connected":"Ready"}</span><span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/75"><Volume2 className="h-3.5 w-3.5"/>NEXO Voice</span></div><div className="flex gap-3"><button onClick={mute} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] text-sm font-semibold">{muted?<Mic className="h-4 w-4"/>:<MicOff className="h-4 w-4"/>}{muted?"Unmute":"Mute"}</button><button onClick={end} className="flex h-12 flex-[1.35] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-red-500 text-sm font-bold"><CircleStop className="h-4 w-4"/>End Talk</button></div></footer>
  </div></section>;
}
