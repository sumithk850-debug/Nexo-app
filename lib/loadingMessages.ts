// NEXO AI — Rotating loading phrases
// Instead of hand-writing hundreds of static strings, we combine short word
// banks to generate hundreds of unique, natural-sounding phrases. Each call
// to getLoadingMessage() picks a fresh random combination.

const VERBS = [
  "Brewing",
  "Steeping",
  "Cooking up",
  "Warming up",
  "Sparking",
  "Weaving",
  "Assembling",
  "Sketching",
  "Distilling",
  "Unpacking",
  "Untangling",
  "Polishing",
  "Stirring",
  "Kindling",
  "Charting",
  "Mapping",
  "Tuning",
  "Threading",
  "Gathering",
  "Piecing together",
];

const OBJECTS = [
  "your answer",
  "a few ideas",
  "the details",
  "some thoughts",
  "the response",
  "a good take",
  "the pieces",
  "your reply",
  "fresh coffee",
  "the signal",
  "some magic",
  "the next line",
  "a plan",
  "clarity",
  "your words",
  "the connections",
  "a spark",
  "something good",
];

const CONNECTORS = [
  "with NEXO",
  "for you",
  "behind the scenes",
  "in the lab",
  "on the grid",
  "just for this",
  "quietly",
  "at full speed",
  "one thought at a time",
  "",
];

const STANDALONE = [
  "Thinking deeply…",
  "Connecting the dots…",
  "Almost there…",
  "One moment…",
  "Reading between the lines…",
  "Loading the signal…",
  "Tuning in…",
  "Getting this right…",
  "Following the thread…",
  "Just a beat…",
  "Bringing it together…",
  "On it…",
  "Working through it…",
  "Finding the words…",
  "Lining things up…",
  "Making sense of it…",
  "Putting it together…",
  "Circling back with an answer…",
  "Sharpening the response…",
  "Filling in the details…",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Returns a random loading phrase. Roughly half the time it combines a
 * verb + object + connector (e.g. "Brewing your answer with NEXO"), and
 * half the time it returns a standalone phrase — giving hundreds of
 * effectively unique combinations without hand-writing each one.
 */
export function getLoadingMessage(): string {
  if (Math.random() < 0.5) {
    return pick(STANDALONE);
  }
  const verb = pick(VERBS);
  const obj = pick(OBJECTS);
  const connector = pick(CONNECTORS);
  return connector ? `${verb} ${obj} ${connector}…` : `${verb} ${obj}…`;
}
