# NEXO Local Browser Connection

This is an optional Manifest V3 extension for desktop Chromium browsers. It runs inside the user's own browser; it does not use a hosted browser, remote desktop, or KYVORIX server.

## Install for local testing

1. Download the repository ZIP from GitHub and extract it.
2. In desktop Chrome or Edge, open the browser's Extensions page.
3. Turn on Developer mode and choose **Load unpacked**.
4. Select the `browser-extension` folder.
5. Pin **NEXO Local Browser Connection** to the toolbar.
6. Return to the NEXO app tab and click the extension icon once, then choose **Connect to NEXO**. After this one-time step, browser-related requests can be started from NEXO chat.

## Security model

- The extension requests only `activeTab` and `scripting` permissions; it does not request all-sites access.
- It should operate only after the user opens its popup for the active tab.
- The NEXO page bridge remains inactive until the user explicitly chooses Connect to NEXO on an NEXO app tab.
- It must not read or transmit cookies, passwords, authentication tokens, or hidden fields.
- Form filling must never submit a form automatically; sensitive actions require a deliberate user action.
- Page text is copied only when the user explicitly requests it. No page content is sent to a remote service automatically.
- Avoid installing unpacked extensions from untrusted sources. Review the source before enabling it.

## Scope

The first implementation is local and user-controlled. It does not publish the extension to a store, require a separate browser-hosting service, or claim a persistent remote AI-control channel. Mobile browser support depends on whether the browser supports extensions; desktop Chrome/Edge is the initial target.
