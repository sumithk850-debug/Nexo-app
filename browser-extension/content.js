if (!window.__KYVORIX_LOCAL_BROWSER_CONTROL_INSTALLED__) {
  window.__KYVORIX_LOCAL_BROWSER_CONTROL_INSTALLED__ = true;

  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const pageInfo = () => ({ title: document.title, url: location.href });
  const reply = (requestId, payload) => window.postMessage({ source: "nexo-browser-extension", requestId, ...payload }, "*");
  let bridgeConnected = false;

  async function runAction(message) {
    const { action } = message;
    if (action === "connect") return { ok: true, action, ...pageInfo(), message: "Local browser connected." };
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
      const name = label(match).slice(0, 100);
      match.click();
      return { ok: true, action, message: "Clicked: " + name };
    }
    if (action === "fill") {
      const needle = String(message.label || "").trim().toLocaleLowerCase();
      const value = String(message.value || "").slice(0, 2000);
      const fields = [...document.querySelectorAll("input,textarea,[contenteditable=true]")].filter((el) => visible(el) && !el.disabled && !el.readOnly);
      const describe = (el) => {
        const label = el.id ? [...document.querySelectorAll("label[for]")].find((item) => item.htmlFor === el.id)?.innerText : "";
        return [label, el.getAttribute("aria-label"), el.getAttribute("placeholder"), el.getAttribute("name")].filter(Boolean).join(" ").toLocaleLowerCase();
      };
      const match = fields.find((el) => !(el instanceof HTMLInputElement && ["password", "hidden", "file", "submit", "button", "reset", "checkbox", "radio"].includes(el.type)) && describe(el).includes(needle));
      if (!match || !needle) return { ok: false, message: "No matching editable field found; sensitive field types are blocked." };
      match.focus();
      if (match instanceof HTMLInputElement || match instanceof HTMLTextAreaElement) {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(match), "value")?.set;
        if (setter) setter.call(match, value); else match.value = value;
      } else match.textContent = value;
      match.dispatchEvent(new Event("input", { bubbles: true }));
      match.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true, action, message: "Field filled. Review the page and submit manually if appropriate." };
    }
    return { ok: false, message: "Unknown browser action." };
  }

  window.addEventListener("message", async (event) => {
    if (!bridgeConnected || event.source !== window || !event.data || event.data.source !== "nexo-browser-page") return;
    const result = await runAction(event.data);
    reply(event.data.requestId, result);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.action !== "string") return false;
    if (message.action === "connect") bridgeConnected = true;
    runAction(message).then((result) => {
      if (message.action === "connect" && result.ok) window.postMessage({ source: "nexo-browser-extension", type: "NEXO_BROWSER_CONNECTED", ...result }, "*");
      sendResponse(result);
    });
    return true;
  });

  // The bridge is intentionally silent until the user explicitly chooses
  // “Connect to NEXO” in the extension popup on this tab.
}
