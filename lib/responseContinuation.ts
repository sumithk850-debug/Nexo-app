export const RESPONSE_CONTINUATION_MARKER = "[KYVORIX:CONTINUE_RESPONSE]";
export const MAX_AUTOMATIC_RESPONSE_CONTINUATIONS = 6;

// Network/edge interruptions are recovered separately from model token-limit continuations.
 // Keep recovery bounded so a persistent outage cannot create an endless retry loop.
export const MAX_AUTOMATIC_RESPONSE_RECOVERIES = 2;

export function canRecoverInterruptedResponse(depth: number): boolean {
  return Number.isInteger(depth) && depth >= 0 && depth < MAX_AUTOMATIC_RESPONSE_RECOVERIES;
}

export function isRecoverableResponseStatus(status: number): boolean {
  return status === 408 || status === 502 || status === 503 || status === 504;
}

export function isRecoverableStreamError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (["TypeError", "NetworkError", "TimeoutError"].includes(error.name)) return true;
  return /network|fetch|stream|connection|timeout|terminated|unexpected end|no response stream|upstream_stream_ended_early/i.test(error.message);
}

export function consumeResponseContinuationMarker(text: string): {
  content: string;
  shouldContinue: boolean;
} {
  const shouldContinue = text.includes(RESPONSE_CONTINUATION_MARKER);
  return {
    content: text.replaceAll(RESPONSE_CONTINUATION_MARKER, ""),
    shouldContinue,
  };
}

export function canAutomaticallyContinue(depth: number): boolean {
  return depth < MAX_AUTOMATIC_RESPONSE_CONTINUATIONS;
}
