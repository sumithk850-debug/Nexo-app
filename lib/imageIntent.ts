const IMAGE_INTENT = /\b(?:create|generate|make|draw|design|render|produce)\b[\s\S]{0,80}\b(?:image|picture|photo|illustration|portrait|wallpaper|logo|poster|artwork|visual)\b|\b(?:image|picture|photo|illustration|portrait|wallpaper|logo|poster|artwork|visual)\b[\s\S]{0,80}\b(?:create|generate|make|draw|design|render|produce)\b|\b(?:image|photo|picture)\s+creation\b/i;
const SINHALA_IMAGE_INTENT = /(?:ඉමේජ්|ඡායාරූප|පින්තූර|රූප|ෆොටෝ|පොටෝ|චිත්‍ර|ලෝගෝ|පෝස්ටර්).*(?:හදන්න|හදලා|නිර්මාණය|ක්‍රියේට්|දෙන්න|අඳින්න|අදින්න)|(?:හදන්න|හදලා|නිර්මාණය|ක්‍රියේට්|දෙන්න|අඳින්න|අදින්න).*(?:ඉමේජ්|ඡායාරූප|පින්තූර|රූප|ෆොටෝ|පොටෝ|චිත්‍ර|ලෝගෝ|පෝස්ටර්)/i;

export function isImageGenerationRequest(text: string): boolean {
  const value = text.trim();
  if (!value || value.length > 4_000) return false;
  return IMAGE_INTENT.test(value) || SINHALA_IMAGE_INTENT.test(value);
}

export function cleanImagePrompt(text: string): string {
  return text
    .replace(/^\s*(?:please\s+)?(?:create|generate|make|draw|design|render|produce)\s+(?:an?\s+)?(?:image|picture|photo|illustration|portrait|wallpaper|logo|poster|artwork|visual)\s*(?:of|about|showing)?\s*/i, "")
    .replace(/^\s*(?:ඉමේජ්|ඡායාරූප|පින්තූර|රූප|ෆොටෝ|පොටෝ|චිත්‍ර)\s*(?:එකක්|යක්)?\s*(?:හදන්න|හදලා දෙන්න|නිර්මාණය කරන්න)\s*/i, "")
    .trim() || text.trim();
}
