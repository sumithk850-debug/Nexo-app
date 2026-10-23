const $ = (id) => document.getElementById(id);
async function tabNow() {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!tab?.id || !/^https?:/.test(tab.url || "")) throw new Error("Open a public webpage first.");
  $("page-title").textContent = tab.title || "Current page";
  $("page-url").textContent = tab.url;
  return tab;
}
async function send(action, payload = {}) {
  const tab = await tabNow();
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:["content.js"]});
  return await chrome.tabs.sendMessage(tab.id,{action,...payload});
}
function report(text, error = false) {
  $("message").textContent = text;
  $("message").classList.toggle("error",error);
}
$("read-page").addEventListener("click",async()=>{
  try {
    const r=await send("read");
    if(!r?.ok) throw new Error(r?.message || "Page read failed.");
    $("page-title").textContent=r.title || "Current page";
    $("page-url").textContent=r.url || "";
    $("output").value=[r.title,r.url,...(r.headings||[]),r.text||""].filter(Boolean).join("\n\n").slice(0,12000);
    report("Read locally. Nothing was sent to a server.");
  } catch(e) { report(e.message || "Could not read page.",true); }
});
$("navigate").addEventListener("click",async()=>{
  try {
    const u=new URL($("url").value.trim());
    const h=u.hostname.toLowerCase();
    if(!["http:","https:"].includes(u.protocol)||h==="localhost"||h.endsWith(".local")||h==="127.0.0.1"||h==="0.0.0.0"||/^10\./.test(h)||/^192\.168\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)) throw new Error("Use a public http/https URL.");
    const tab=await tabNow();
    await chrome.tabs.update(tab.id,{url:u.href});
    report("Navigation requested. Reopen this popup after the page loads.");
  } catch(e) { report(e.message || "Navigation failed.",true); }
});
$("click-target").addEventListener("click",async()=>{
  try {
    const text=$("target").value.trim();
    if(!text) throw new Error("Enter visible link or button text.");
    const r=await send("click",{text});
    report(r?.message || "No matching item.",!r?.ok);
  } catch(e) { report(e.message || "Click failed.",true); }
});
$("fill-field").addEventListener("click",async()=>{
  try {
    const label=$("field").value.trim();
    if(!label) throw new Error("Enter a field label or placeholder.");
    const r=await send("fill",{label,value:$("value").value});
    report(r?.message || "Could not fill field.",!r?.ok);
  } catch(e) { report(e.message || "Fill failed.",true); }
});
$("copy-page").addEventListener("click",async()=>{
  try {
    const text=$("output").value;
    if(!text) throw new Error("Read the page first.");
    await navigator.clipboard.writeText(text);
    report("Summary copied. Paste it into KYVORIX when ready.");
  } catch(e) { report(e.message || "Copy failed.",true); }
});
tabNow().catch(e=>report(e.message,true));
