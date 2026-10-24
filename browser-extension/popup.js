const $ = (id) => document.getElementById(id);
function isKyvorixApp(tab) {
  try { const host = new URL(tab.url || "").hostname.toLowerCase(); return host.includes("kyvorix") || host.includes("nexo-app") || host === "nexo" || host.startsWith("nexo-") || /kyvorix/i.test(tab.title || ""); }
  catch { return false; }
}
async function tabNow() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url || "")) throw new Error("Open a normal website or the KYVORIX app first.");
  $("page-title").textContent = tab.title || "Current page"; $("page-url").textContent = tab.url;
  const appTab = isKyvorixApp(tab);
  $("connect-kyvorix").textContent = appTab ? "Connect to KYVORIX" : "Use this tab with KYVORIX";
  $("connect-kyvorix").title = appTab ? "Register this KYVORIX app tab" : "Select this website as the tab KYVORIX can use";
  return tab;
}
async function send(action, payload = {}) {
  const tab = await tabNow();
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  const actualAction = action === "connect" && !isKyvorixApp(tab) ? "select-target" : action;
  return chrome.tabs.sendMessage(tab.id, { action: actualAction, ...payload });
}
function report(text, error = false) { $("message").textContent = text; $("message").classList.toggle("error", error); $("status").textContent = error ? "CHECK" : "READY"; }
$("connect-kyvorix").addEventListener("click", async () => {
  try {
    const tab = await tabNow(); const appTab = isKyvorixApp(tab); const r = await send("connect");
    if (!r?.ok) throw new Error(r?.message || "Could not connect the local browser.");
    report(appTab ? "KYVORIX is connected to the selected website tab." : "Website tab selected. Return to KYVORIX and connect there.");
  } catch (e) { report(e.message || "Could not connect the local browser.", true); }
});
$("read-page").addEventListener("click", async () => {
  try {
    const r = await send("read"); if (!r?.ok) throw new Error(r?.message || "Page read failed.");
    $("page-title").textContent = r.title || "Current page"; $("page-url").textContent = r.url || "";
    $("output").value = [r.title, r.url, ...(r.headings || []), r.text || ""].filter(Boolean).join("\n\n").slice(0, 12000);
    report("Read locally. Nothing was sent to a server.");
  } catch (e) { report(e.message || "Could not read page.", true); }
});
$("navigate").addEventListener("click", async () => {
  try { const u = new URL($("url").value.trim()); if (!["http:","https:"].includes(u.protocol)) throw new Error("Use a public http/https URL.");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!tab?.id) throw new Error("No active tab.");
    await chrome.tabs.update(tab.id, { url: u.href }); report("Navigation requested. Reopen the popup after loading, then select this tab again.");
  } catch (e) { report(e.message || "Navigation failed.", true); }
});
$("click-target").addEventListener("click", async () => {
  try { const text = $("target").value.trim(); if (!text) throw new Error("Enter visible link or button text.");
    const r = await send("click", { text }); report(r?.message || "No matching item.", !r?.ok);
  } catch (e) { report(e.message || "Click failed.", true); }
});
$("fill-field").addEventListener("click", async () => {
  try { const label = $("field").value.trim(); if (!label) throw new Error("Enter a field label or placeholder.");
    const r = await send("fill", { label, value: $("value").value }); report(r?.message || "Could not fill field.", !r?.ok);
  } catch (e) { report(e.message || "Fill failed.", true); }
});
$("copy-page").addEventListener("click", async () => {
  try { const text = $("output").value; if (!text) throw new Error("Read the page first.");
    await navigator.clipboard.writeText(text); report("Summary copied. Paste it into KYVORIX when ready.");
  } catch (e) { report(e.message || "Copy failed.", true); }
});
tabNow().catch((e) => report(e.message, true));
