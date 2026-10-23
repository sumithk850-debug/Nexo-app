const BROWSER_PATTERNS = [
  /\bbrowser\b/i,
  /\bchrome\b/i,
  /\bedge\b/i,
  /\bcurrent\s+tab\b/i,
  /\bweb\s+page\b/i,
  /\bconnect\s+(?:my\s+)?browser\b/i,
  /\bread\s+(?:this|the|current)\s+page\b/i,
  /\bopen\s+(?:this|the)\s+page\b/i,
  /බ්‍රව්සර/i,
  /බ්‍රවුසර/i,
  /ක්‍රෝම්/i,
  /එජ්/i,
  /ටැබ්/i,
  /වෙබ්\s*(?:පේජ්|පිටුව)/i,
  /බ්‍රව්සරය.*(?:කනෙක්|සම්බන්ධ|බලන්න|කියවන්න)/i,
];

export function isBrowserIntent(text: string): boolean {
  const value = text.trim();
  if (!value || value.length > 4_000) return false;
  return BROWSER_PATTERNS.some((pattern) => pattern.test(value));
}

export type BrowserAction = "connect" | "read";

export function inferBrowserAction(text: string): BrowserAction {
  return /\b(read|open|inspect|summar|analy[sz]e|current\s+page)\b|කියව|බල|රීඩ්|පරීක්ෂ/i.test(text)
    ? "read"
    : "connect";
}
