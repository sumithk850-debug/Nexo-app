// KYVORIX AI — Anonymous session identity
// Since auth hasn't shipped yet, we generate a random ID per browser and
// store it in localStorage. This scopes chat history to "this device" until
// a real login system replaces it. Once auth ships, this can be swapped for
// the authenticated user's ID with minimal changes to callers.

const SESSION_KEY = "nexo_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = localStorage.getItem(SESSION_KEY);
  const isCanonicalUuidV4 =
    typeof sessionId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId);

  if (!isCanonicalUuidV4) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}
