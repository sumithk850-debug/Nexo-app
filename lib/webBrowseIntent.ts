// KYVORIX AI — does this message ask the assistant to look something up on the
// web or on GitHub and go inside what it finds (open a repository, a folder, a
// page, a link)? Pure and dependency-free so it can be verified directly.

const MAX_LENGTH = 4_000;

// "sumith's repo", "torvalds' repositories", "someone's github profile"
const POSSESSIVE_REPO = /\b[\w.-]+['’]s?\s+(?:public\s+|github\s+|open[- ]source\s+)?(?:repo|repos|repository|repositories|github|git hub|profile|projects?|account)\b/i;
// "github.com/owner" or "github.com/owner/repo" without a scheme
const BARE_GITHUB_PATH = /(?:^|[\s(])(?:www\.)?github\.com\/[A-Za-z0-9][\w.-]*/i;
// "owner/repo" together with the word repo/repository/github
const OWNER_SLASH_REPO = /\b[A-Za-z0-9][\w-]{0,38}\/[A-Za-z0-9_.-]{2,100}\b/;
const REPO_WORD = /\b(?:repo|repos|repository|repositories|github|git hub)\b/i;

const LOOKUP_VERB = /\b(?:search|find|look\s*up|lookup|locate|browse|visit|open|go\s+(?:to|into|inside)|enter|check\s*out|explore|inspect|look\s+(?:at|into|inside)|read|fetch|show|view|navigate|dig\s+into)\b/i;
const WEB_PLACE = /\b(?:on\s+the\s+(?:web|internet)|on\s+(?:the\s+)?github|on\s+google|online|from\s+the\s+(?:web|internet|github)|web\s*site|website|webpage|web\s*page|the\s+web|internet|github|google)\b/i;
const WEB_TARGET = /\b(?:repo|repos|repository|repositories|profile|account|page|site|website|link|url|readme|project|folder|directory|file)\b/i;

const SI_PLACE = /(?:වෙබ්\s*(?:එකේ|එකෙන්|අඩවි|අඩවියේ|අඩවියෙන්)|අන්තර්ජාලයෙන්|අන්තර්ජාලයේ|ඉන්ටර්නෙට්\s*එකෙන්|ඉන්ටර්නෙට්\s*එකේ|ඔන්ලයින්|ගිතුබ්\s*(?:එකේ|එකෙන්)?|ගූගල්)/i;
const SI_VERB = /(?:සොයන්න|සොයලා|හොයන්න|හොයලා|සොයා\s*බලන්න|බලන්න|ගිහින්\s*බලන්න|ගිහිල්ලා\s*බලන්න|පිවිසෙන්න|පිවිසිලා|ඇතුලට|ඇතුළට|විවෘත\s*කරන්න|කියවන්න|පරීක්ෂා\s*කරන්න)/i;
// "sumith ගේ repo එක", "කමල්ගේ ගිතුබ් එක"
const SI_POSSESSIVE_REPO = /[\w.-]+\s*ගේ\s+(?:repo|repos|repository|github|profile|project|රෙපෝ|රිපෝ|රිපොසිටරි|ගිතුබ්|ප්‍රොෆයිල්|ව්‍යාපෘති)/i;
const SI_TARGET = /(?:රෙපෝ|රිපෝ|රිපොසිටරි|ගබඩාව|ෆයිල්|ගොනුව|ෆෝල්ඩර|ප්‍රොෆයිල්|ගිතුබ්|වෙබ්\s*අඩවිය|වෙබ්සයිට්|ලින්ක්|පිටුව|ව්‍යාපෘති)/i;

export function shouldUseWebBrowseIntent(raw: string): boolean {
  const text = raw.trim();
  if (!text || text.length > MAX_LENGTH) return false;

  if (BARE_GITHUB_PATH.test(text)) return true;
  if (POSSESSIVE_REPO.test(text) && LOOKUP_VERB.test(text)) return true;
  if (OWNER_SLASH_REPO.test(text) && REPO_WORD.test(text) && LOOKUP_VERB.test(text)) return true;
  if (LOOKUP_VERB.test(text) && WEB_PLACE.test(text) && WEB_TARGET.test(text)) return true;

  // Sinhala (often mixed with English words such as "repo").
  const siTarget = SI_TARGET.test(text) || WEB_TARGET.test(text);
  if (SI_PLACE.test(text) && SI_VERB.test(text) && siTarget) return true;
  if ((POSSESSIVE_REPO.test(text) || SI_POSSESSIVE_REPO.test(text)) && SI_VERB.test(text)) return true;
  if (OWNER_SLASH_REPO.test(text) && siTarget && SI_VERB.test(text)) return true;
  return false;
}
