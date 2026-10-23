import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../lib/browserIntent.ts", import.meta.url), "utf8");
assert.match(source, /browser/i, "Browser intent rules must include browser language.");
assert.match(source, /බ්‍රව්සර/i, "Browser intent rules must include Sinhala browser language.");
assert.match(source, /inferBrowserAction/, "Browser actions must distinguish connect from read.");
assert.match(source, /return \/.*read.*\|.*කියව/, "Read requests must be detected.");
assert.doesNotMatch(source, /token|password|cookie/i, "Intent detection must not handle secrets.");
console.log("Browser connection intent checks passed.");
