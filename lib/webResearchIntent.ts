const EXCLUDED_TASK = /\b(?:code|coding|debug|debugging|programming|translate|translation|rewrite|rephrase|proofread|poem|story|creative writing|math|calculate|sql|supabase|vercel|github|repository|database|schema|file|component|function)\b/i;

const WEB_SIGNALS = /\b(?:search(?: the)? web|search online|look up|find out|research|latest|current|currently|today|recent|news|sources?|source links|compare|comparison|review|price|pricing|release|announcement|statistics|what happened|who is|what is|what are|where is|when did|how much|which|tell me about|information about)\b/i;

const SI_WEB_SIGNALS = /අලුත්ම|නවතම|දැනට|වත්මන්|අද|මෑතක|පුවත්|පර්යේෂණ|මූලාශ්‍ර|සසඳ|මිල|තොරතුරු සොය|සොයා බල|අන්තර්ජාලයෙන්|කවුද|කවුරුද|මොකක්ද|කොහෙද|කවදාද|කොහොමද|ඇයි|ගැන කියන්න|විස්තර සොය/i;

export function shouldUseWebResearchIntent(raw: string): boolean {
  const query = raw.trim();
  if (!query || query.length > 4_000 || EXCLUDED_TASK.test(query)) return false;
  if (/https?:\/\//i.test(query)) return true;
  return WEB_SIGNALS.test(query) || SI_WEB_SIGNALS.test(query);
}
