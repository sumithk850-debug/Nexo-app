// NEXO AI — Anonymous session identity
// Since auth hasn't shipped yet, we generate a random ID per browser and
// store it in localStorage. This scopes chat history to "this device" until
// a real login system replaces it. Once auth ships, this can be swapped for
// the authenticated user's ID with minimal changes to callers.

const SESSION_KEY = "nexo_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}
