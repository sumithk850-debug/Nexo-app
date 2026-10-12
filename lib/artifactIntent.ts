const ARTIFACT_TERMS = /\b(?:excel|xlsx|spreadsheet|workbook|worksheet|sheet|csv|budget|expense tracker|invoice|payroll|inventory|sales tracker)\b/i;
const ARTIFACT_SINHALA = /එක්සෙල්|ස්ප්‍රෙඩ්ෂීට්|බජට්|වියදම්|ඉන්වොයිස්|වැටුප්|ඉන්වෙන්ටරි|වර්ක්බුක්/i;
const ACTION_TERMS = /\b(?:create|make|build|generate|prepare|export|download|turn .* into)\b/i;
const ACTION_SINHALA = /(?:හදන්න|හදා\s*දෙන්න|හදලා\s*දෙන්න|සාදන්න|නිර්මාණය\s*කරන්න|සකස්\s*කරන්න|සකස්\s*කරලා\s*දෙන්න|බාගත|එක්සෙල්\s*(?:එකක්|ෆයිල්|ශීට්))/i;

export function isArtifactRequest(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > 4000) return false;
  return (ARTIFACT_TERMS.test(text) || ARTIFACT_SINHALA.test(text)) &&
    (ACTION_TERMS.test(text) || ACTION_SINHALA.test(text));
}
