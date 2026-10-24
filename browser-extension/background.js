const APP_TAB_KEY = "kyvorixAppTabId";
const TARGET_TAB_KEY = "kyvorixTargetTabId";

function isAppUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (url.protocol === "https:" || (url.protocol === "http:" && (host === "localhost" || host === "127.0.0.1"))) && (host.includes("kyvorix") || host.includes("nexo-app") || host === "nexo" || host.startsWith("nexo-") || host === "localhost" || host === "127.0.0.1");
  } catch { return false; }
}

async function notifyApp(message) {
  const saved = await chrome.storage.session.get(APP_TAB_KEY);
  if (!Number.isInteger(saved[APP_TAB_KEY])) return;
  try { await chrome.tabs.sendMessage(saved[APP_TAB_KEY], { type: "KYVORIX_EXTENSION_STATUS", ...message }); } catch {}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "KYVORIX_REGISTER_APP_TAB") {
      const tabId = sender.tab?.id;
      if (!Number.isInteger(tabId) || !isAppUrl(sender.tab?.url || "")) {
        sendResponse({ ok: false, message: "Open the KYVORIX AI app tab before connecting." }); return;
      }
      await chrome.storage.session.set({ [APP_TAB_KEY]: tabId });
      const saved = await chrome.storage.session.get(TARGET_TAB_KEY);
      if (!Number.isInteger(saved[TARGET_TAB_KEY])) {
        sendResponse({ ok: false, message: "App tab linked. Open the website you want to use, click the extension, choose Use this tab with KYVORIX, then connect again here." }); return;
      }
      try {
        const target = await chrome.tabs.get(saved[TARGET_TAB_KEY]);
        if (!/^https?:/.test(target.url || "")) throw new Error();
        sendResponse({ ok: true, connected: true, type: "KYVORIX_BROWSER_CONNECTED", action: "connect", title: target.title || "Selected website", url: target.url, message: "KYVORIX is connected to the selected website tab." });
      } catch {
        await chrome.storage.session.remove(TARGET_TAB_KEY);
        sendResponse({ ok: false, message: "The selected website tab is no longer available. Select it again from the extension popup." });
      }
      return;
    }
    if (message?.type === "KYVORIX_REGISTER_TARGET_TAB") {
      const tabId = sender.tab?.id;
      const url = sender.tab?.url || "";
      if (!Number.isInteger(tabId) || !/^https?:/.test(url) || isAppUrl(url)) {
        sendResponse({ ok: false, message: "Open the website you want KYVORIX to use, not the KYVORIX app tab." }); return;
      }
      await chrome.storage.session.set({ [TARGET_TAB_KEY]: tabId });
      const result = { ok: true, connected: true, action: "select-target", title: sender.tab.title || "Selected website", url, message: "Website tab selected. Return to KYVORIX and connect there." };
      await notifyApp({ type: "KYVORIX_BROWSER_CONNECTED", ...result });
      sendResponse(result); return;
    }
    if (message?.type === "KYVORIX_APP_REQUEST") {
      const saved = await chrome.storage.session.get([APP_TAB_KEY, TARGET_TAB_KEY]);
      if (!Number.isInteger(sender.tab?.id) || sender.tab.id !== saved[APP_TAB_KEY]) {
        sendResponse({ ok: false, requestId: message.requestId, message: "Connect this KYVORIX app tab from the extension popup first." }); return;
      }
      if (!Number.isInteger(saved[TARGET_TAB_KEY])) {
        sendResponse({ ok: false, requestId: message.requestId, message: "No website tab selected. Open the target website and choose Use this tab with KYVORIX from the extension popup." }); return;
      }
      if (!["read", "click", "fill"].includes(message.action)) {
        sendResponse({ ok: false, requestId: message.requestId, message: "This browser action is not allowed." }); return;
      }
      try {
        const target = await chrome.tabs.get(saved[TARGET_TAB_KEY]);
        if (!/^https?:/.test(target.url || "")) throw new Error();
        const result = await chrome.tabs.sendMessage(saved[TARGET_TAB_KEY], { type: "KYVORIX_TARGET_ACTION", action: message.action, requestId: message.requestId, text: message.text, label: message.label, value: message.value });
        sendResponse({ ...result, requestId: message.requestId });
      } catch {
        sendResponse({ ok: false, requestId: message.requestId, message: "Could not reach the selected website tab. Open its extension popup and select the tab again." });
      }
      return;
    }
    sendResponse({ ok: false, message: "Unknown extension message." });
  })().catch(() => sendResponse({ ok: false, requestId: message?.requestId, message: "The local browser bridge encountered an error." }));
  return true;
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const saved = await chrome.storage.session.get([APP_TAB_KEY, TARGET_TAB_KEY]);
  const remove = [];
  if (saved[APP_TAB_KEY] === tabId) remove.push(APP_TAB_KEY);
  const targetClosed = saved[TARGET_TAB_KEY] === tabId;
  if (targetClosed) remove.push(TARGET_TAB_KEY);
  if (remove.length) await chrome.storage.session.remove(remove);
  if (targetClosed) await notifyApp({ type: "KYVORIX_BROWSER_DISCONNECTED", message: "The selected website tab was closed. Select another website tab to continue." });
});
