const PRESENTATION_TERMS = /\b(?:presentation|presentations|slides|slide deck|pptx|powerpoint|pitch deck|investor deck)\b/i;
const PRESENTATION_SINHALA = /ස්ලයිඩ්|ප්‍රසන්ටේෂන්|පවර්පොයින්ට්|ඉන්වෙස්ටර් ඩෙක්/i;
const ACTION_TERMS = /\b(?:create|make|build|generate|prepare|export|design)\b/i;
const ACTION_SINHALA = /හදන්න|සාදන්න|නිර්මාණය|සකස්|දෙන්න/i;

export function isPresentationRequest(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > 4000) return false;
  return (PRESENTATION_TERMS.test(text) || PRESENTATION_SINHALA.test(text)) &&
    (ACTION_TERMS.test(text) || ACTION_SINHALA.test(text));
}
