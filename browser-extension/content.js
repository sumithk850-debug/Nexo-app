if (!window.__KYVORIX_LOCAL_BROWSER_CONTROL_INSTALLED__) {
  window.__KYVORIX_LOCAL_BROWSER_CONTROL_INSTALLED__ = true;
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const pageInfo = () => ({ title: document.title, url: location.href });
  const reply = (requestId, payload) => window.postMessage({ source: "kyvorix-browser-extension", requestId, ...payload }, location.origin);

  async function runPageAction(message) {
    const { action } = message;
    if (action === "read") {
      const headings = [...document.querySelectorAll("h1,h2,h3")].filter(visible).slice(0, 20).map((el) => (el.innerText || "").trim()).filter(Boolean);
      return { ok: true, action, ...pageInfo(), headings, text: (document.body?.innerText || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 10000) };
    }
    if (action === "click") {
      const needle = String(message.text || "").trim().toLocaleLowerCase();
      if (!needle || needle.length > 160) return { ok: false, message: "Enter visible link or button text." };
      const candidates = [...document.querySelectorAll("a[href],button,[role=button]")].filter((el) => visible(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true");
      const label = (el) => (el.innerText || el.getAttribute("aria-label") || "").trim();
      const match = candidates.find((el) => label(el).toLocaleLowerCase() === needle) || candidates.find((el) => label(el).toLocaleLowerCase().includes(needle));
      if (!match) return { ok: false, message: "No visible link or button matched." };
      const name = label(match).slice(0, 100); match.click();
      return { ok: true, action, ...pageInfo(), message: "Clicked: " + name };
    }
    if (action === "fill") {
      const needle = String(message.label || "").trim().toLocaleLowerCase();
      const value = String(message.value || "").slice(0, 2000);
      const fields = [...document.querySelectorAll("input,textarea,[contenteditable=true]")].filter((el) => visible(el) && !el.disabled && !el.readOnly);
      const describe = (el) => {
        const label = el.id ? [...document.querySelectorAll("label[for]")].find((item) => item.htmlFor === el.id)?.innerText : "";
        return [label, el.getAttribute("aria-label"), el.getAttribute("placeholder"), el.getAttribute("name")].filter(Boolean).join(" ").toLocaleLowerCase();
      };
      const match = fields.find((el) => !(el instanceof HTMLInputElement && ["password","hidden","file","submit","button","reset","checkbox","radio"].includes(el.type)) && describe(el).includes(needle));
      if (!match || !needle) return { ok: false, message: "No matching editable field found; sensitive field types are blocked." };
      match.focus();
      if (match instanceof HTMLInputElement || match instanceof HTMLTextAreaElement) {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(match), "value")?.set;
        if (setter) setter.call(match, value); else match.value = value;
      } else match.textContent = value;
      match.dispatchEvent(new Event("input", { bubbles: true }));
      match.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true, action, ...pageInfo(), message: "Field filled. Review the page and submit manually if appropriate." };
    }
    return { ok: false, message: "Unknown browser action." };
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== location.origin || !event.data || event.data.source !== "kyvorix-browser-page") return;
    if (!["connect","read"].includes(event.data.action) || typeof event.data.requestId !== "string") return;
    if (event.data.action === "connect") {
      const result = await chrome.runtime.sendMessage({ type: "KYVORIX_REGISTER_APP_TAB" });
      reply(event.data.requestId, result || { ok: false, message: "The extension did not respond." });
      return;
    }
    const result = await chrome.runtime.sendMessage({ type: "KYVORIX_APP_REQUEST", action: event.data.action, requestId: event.data.requestId });
    reply(event.data.requestId, result || { ok: false, message: "The browser bridge did not respond." });
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return false;
    if (message.type === "KYVORIX_EXTENSION_STATUS") {
      window.postMessage({ source: "kyvorix-browser-extension", ...message }, location.origin);
      sendResponse({ ok: true }); return false;
    }
    if (message.type === "KYVORIX_TARGET_ACTION") {
      runPageAction(message).then(sendResponse).catch(() => sendResponse({ ok: false, message: "Could not complete this page action." }));
      return true;
    }
    if (typeof message.action !== "string") return false;
    if (message.action === "connect") {
      chrome.runtime.sendMessage({ type: "KYVORIX_REGISTER_APP_TAB" }).then(sendResponse).catch(() => sendResponse({ ok: false, message: "Could not connect this app tab." }));
      return true;
    }
    if (message.action === "select-target") {
      chrome.runtime.sendMessage({ type: "KYVORIX_REGISTER_TARGET_TAB" }).then(sendResponse).catch(() => sendResponse({ ok: false, message: "Could not select this website tab." }));
      return true;
    }
    runPageAction(message).then(sendResponse).catch(() => sendResponse({ ok: false, message: "Could not complete this page action." }));
    return true;
  });
}
