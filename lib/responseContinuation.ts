export const RESPONSE_CONTINUATION_MARKER = "[NEXO:CONTINUE_RESPONSE]";
export const MAX_AUTOMATIC_RESPONSE_CONTINUATIONS = 6;

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
