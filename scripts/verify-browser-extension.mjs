import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const manifest = JSON.parse(read("../browser-extension/manifest.json"));
const popup = read("../browser-extension/popup.js");
const contentScript = read("../browser-extension/content.js");

assert.equal(manifest.manifest_version, 3, "Extension must use Manifest V3.");
assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "scripting"], "Only per-tab scripting permissions should be requested.");
assert.equal(manifest.host_permissions, undefined, "Extension must not request persistent host permissions.");
assert.equal(manifest.content_scripts, undefined, "Extension must not run automatically on all websites.");
assert.match(popup, /chrome\.scripting\.executeScript/, "Page helper should be injected only after a popup action.");
assert.match(popup, /files:\s*\["content\.js"\]/, "The popup should inject the reviewed local content helper.");
assert.match(contentScript, /message\.action === "read"/, "Page reading command is required.");
assert.match(contentScript, /message\.action === "click"/, "Visible link/button action is required.");
assert.match(contentScript, /message\.action === "fill"/, "Form field fill action is required.");
assert.match(contentScript, /password/, "Password fields must be blocked.");
assert.match(contentScript, /match\.click\(\)/, "Click actions must be explicit and target-matched.");
assert.doesNotMatch(contentScript, /\.submit\s*\(|requestSubmit\s*\(/, "Forms must never be submitted automatically.");
assert.doesNotMatch(popup, /cookies/, "Popup must not use cookie APIs.");
assert.doesNotMatch(manifest.permissions, /cookies/, "Cookie permission must not be requested.");

console.log("Browser extension security and capability checks passed.");
