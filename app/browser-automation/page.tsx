import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, Globe, ShieldCheck, TerminalSquare } from "lucide-react";

const steps = [
  "Install the NEXO Local Browser Connection extension from the provided browser install source.",
  "Open chrome://extensions in Chrome or edge://extensions in Edge on desktop.",
  "Enable Developer mode, choose Load unpacked, and select the browser-extension folder.",
  "Open a normal webpage, open the NEXO extension once, and choose Connect to NEXO. This one-time step enables chat-triggered browser cards.",
];

export default function BrowserAutomationPage() {
  return (
    <main className="min-h-screen bg-[#070b14] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-cyan-300 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to KYVORIX AI</Link>
        <div className="mt-8 rounded-3xl border border-cyan-400/20 bg-[radial-gradient(ellipse_at_top_left,_rgba(8,145,178,0.16),_transparent_55%),#0b1220] p-6 shadow-2xl shadow-cyan-950/20 sm:p-9">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200"><Globe className="h-6 w-6" /></div>
            <div><p className="text-xs font-semibold tracking-[0.22em] text-cyan-300">LOCAL · USER-CONTROLLED</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">NEXO Browser Connection</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Connect your own desktop Chrome or Edge browser once. After that, ask NEXO in chat when you want to read a page or request a browser action. There is no hosted browser or separate browser service.</p></div>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Local by design</div><p className="mt-2 text-xs leading-5 text-slate-300">Page text stays in the browser unless you choose to copy it and paste it into KYVORIX yourself.</p></div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-cyan-200"><ShieldCheck className="h-4 w-4" /> Limited permissions</div><p className="mt-2 text-xs leading-5 text-slate-300">The extension requests access to the active tab only after you open it. It does not request cookie access or all-sites permission.</p></div>
          </div>
          <h2 className="mt-8 text-lg font-semibold">Set it up on desktop</h2>
          <ol className="mt-4 space-y-3">
            {steps.map((step, index) => <li key={step} className="flex gap-3 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-400/30 text-xs font-bold text-cyan-200">{index + 1}</span><span className="pt-1 text-sm leading-6 text-slate-300">{step}</span></li>)}
          </ol>
          <a href="https://github.com/sumithk850-debug/Nexo-app/tree/main/browser-extension" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/15"><TerminalSquare className="h-4 w-4" /> View NEXO extension source <ExternalLink className="h-3.5 w-3.5" /></a>
          <h2 className="mt-8 text-lg font-semibold">What it can do</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            <li>• Read visible page text and headings in your current tab.</li>
            <li>• Navigate to a public HTTP/HTTPS address.</li>
            <li>• Find and click a visible link or button by its text.</li>
            <li>• Fill a matching regular text field; it never submits a form automatically.</li>
            <li>• Copy a page summary for you to paste into KYVORIX when you choose.</li>
          </ul>
          <div className="mt-7 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-5 text-amber-100/90"><strong>Important:</strong> Review each action before using it. Password, hidden, file, checkbox, and radio fields are blocked. The extension does not automatically execute AI instructions, send page contents to a server, or submit forms. It currently targets desktop Chromium browsers; mobile support depends on the browser's extension support.</div>
        </div>
      </div>
    </main>
  );
}
