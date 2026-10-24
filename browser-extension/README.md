# KYVORIX Local Browser Control

This Manifest V3 extension connects KYVORIX chat to a website tab that you explicitly select in your own desktop Chrome or Edge browser. It does not use a hosted browser, remote desktop, or browser-hosting service.

## One-time local setup

1. Get the extension source from the repository and load the `browser-extension` folder using `chrome://extensions` (Chrome) or `edge://extensions` (Edge) with Developer mode enabled. This unpacked installation is currently the supported distribution; the extension is not yet published to a browser store.
2. Pin **KYVORIX Browser Control** to the toolbar.
3. Open the website tab you want KYVORIX to use. Open the extension popup and click **Use this tab with KYVORIX**.
4. Return to the KYVORIX AI app tab. Open the extension popup and click **Connect to KYVORIX**.
5. Return to chat and ask KYVORIX to read the selected page. Repeat step 3 whenever you switch website tabs or after the selected tab navigates to a new page.

The app tab and target website tab are registered locally for the current browser session. If the browser is restarted, select and connect the tabs again.

## Security model

- The extension requests `activeTab` access only when you open its popup for a tab; it does not request all-sites host permissions.
- A website tab must be explicitly selected by the user before chat actions can be routed to it.
- Browser actions are limited to reading visible page text, clicking a visible matching link/button, and filling a matching ordinary editable field.
- Password, hidden, file, submit, button, reset, checkbox, and radio input types are blocked from filling.
- Forms are never submitted automatically.
- Cookies, passwords, hidden fields, and page contents are not stored on the KYVORIX server by this extension.
- Only use extension source you trust.

## Current scope and limitations

- Desktop Chromium browsers (Chrome/Edge) are the initial target; mobile support depends on browser extension support.
- The extension is not currently store-published, so initial installation still requires loading the extension folder once.
- The extension can only act on a website tab where the user explicitly opened its popup and granted active-tab access.
