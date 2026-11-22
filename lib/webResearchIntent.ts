const EXCLUDED_TASK = /\b(?:code|coding|debug|debugging|programming|translate|translation|rewrite|rephrase|proofread|poem|story|creative writing|math|calculate|sql|database schema design|write a function|explain this code|review this code)\b/i;

const RESTRICTED_TOPIC = /\b(?:firearms?|guns?|ammunition|weapon(?:s)?|switchblades?|knives|knifes|pepper spray|tasers?|explosives?|bombs?|grenades?|poisons?|toxic chemicals|illegal drugs|recreational drugs|marijuana|cannabis|thc|cocaine|heroin|methamphetamine|fentanyl|vapes?|tobacco|nicotine|alcohol|liquor|gambling|casino|sports betting|sportsbook|wagering|betting sites|dangerous challenge|dangerous stunt)\b/i;

export function isSafeWebResearchQuery(query: string): boolean {
  return !RESTRICTED_TOPIC.test(query);
}

// Explicit requests to consult the public web. Ordinary question words such as
// "what is", "explain", "how does", and "which" are deliberately NOT signals.
const EXPLICIT_WEB_SIGNALS = /\b(?:search (?:the )?(?:web|internet|online)|web search|browse (?:the )?(?:web|internet)|google (?:it|this|that|for)|look up online|research online|find (?:this|that|information|sources?) online|search for|check online|verify online|fact[- ]check|find source links|include (?:web )?sources|with citations from the web|on the internet)\b/i;
const SI_EXPLICIT_WEB_SIGNALS = /(?:අන්තර්ජාලයෙන්|වෙබ් එකේ|ගූගල් කර|ගූගල් එකෙන්|සර්ච් කර|සෙවුම් කර|ඔන්ලයින් සොය|අන්තර්ජාලයේ සොය|වෙබ් සර්ච්).{0,45}(?:සොය|හොය|බල|තොරතුරු|විස්තර)?|(?:සොයා බලන්න|හොයලා බලන්න|සර්ච් කරන්න|සෙවුම් කරන්න|ගූගල් කරන්න)/i;

// These signals mean the answer is likely to have changed and needs fresh
// evidence. They do not include generic question/explanation phrasing.
const FRESHNESS_SIGNALS = /\b(?:latest|newest|current|currently|right now|today|tonight|this week|this month|this year|recent|recently|up[- ]to[- ]date|as of \d{4}|in \d{4}|breaking|live updates|today'?s news|latest news|current price|latest price|current pricing|latest release|new release|recent update)\b/i;
const SI_FRESHNESS_SIGNALS = /අලුත්ම|නවතම|දැනට|වත්මන්|වර්තමානයේ|අද පුවත්|අද දවසේ පුවත්|අද|මේ සතියේ|මේ මාසයේ|මේ අවුරුද්දේ|මෑතකදී|මෑතම|යාවත්කාලීන|සජීවී පුවත්|දැනට පවතින මිල|අලුත් මිල|නව නිකුතුව|මෑත යාවත්කාලීන/i;

const DATE_TIME_ONLY = /^(?:what(?:'s| is) )?(?:today'?s date|the date today|the current time|time is it|today'?s day|what day is it)\??$/i;
const SI_DATE_TIME_ONLY = /^(?:අද දිනය කුමක්ද|අද දවස කවදාද|දැන් වෙලාව කීයද|දැන් වේලාව කීයද|අද කවදාද)\??$/i;

export function shouldUseWebResearchIntent(raw: string): boolean {
  const query = raw.trim();
  if (!query || query.length > 4_000 || EXCLUDED_TASK.test(query) || !isSafeWebResearchQuery(query)) return false;
  if (/https?:\/\//i.test(query)) return true;
  if (EXPLICIT_WEB_SIGNALS.test(query) || SI_EXPLICIT_WEB_SIGNALS.test(query)) return true;
  if (DATE_TIME_ONLY.test(query) || SI_DATE_TIME_ONLY.test(query)) return false;
  // Freshness alone is insufficient: require a real subject as well.
  const hasFreshness = FRESHNESS_SIGNALS.test(query) || SI_FRESHNESS_SIGNALS.test(query);
  const subject = query.replace(FRESHNESS_SIGNALS, " ").replace(SI_FRESHNESS_SIGNALS, " ").replace(/[?!.，,。:;\s]/g, "");
  return hasFreshness && subject.length >= 3;
}
