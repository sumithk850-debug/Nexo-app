import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const auth = readFileSync("lib/auth.ts", "utf8");
const modal = readFileSync("components/AuthModal.tsx", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const settings = readFileSync("components/SettingsPanel.tsx", "utf8");

// OAuth sign-in and linking must use Supabase Auth, not the separate repository-token flow.
assert.match(auth, /signInWithOAuth\(\{[\s\S]*provider: "github"/);
assert.match(auth, /linkIdentity\(\{[\s\S]*provider: "github"/);
assert.match(auth, /kyvorix\.github\.profile\.pending/);
assert.match(auth, /updateUser\(\{ data \}\)/);
assert.match(auth, /profile_prompted/);

// Name and birthday are optional for both email signup and GitHub onboarding.
assert.match(modal, /Your name \(optional\)/);
assert.match(modal, /Skip for now/);
assert.match(modal, /profilePrompted: true/);
assert.match(modal, /Continue with GitHub/);
assert.match(modal, /setStep\("confirm"\)/);
assert.doesNotMatch(modal, /Please enter your birthday\./);
assert.doesNotMatch(modal, /Please enter your name\./);

// GitHub OAuth profile onboarding only opens after redirect and preserves normal auth.
assert.match(page, /profileSetupOpen/);
assert.match(page, /!u\.profilePrompted/);
assert.match(page, /initialBirthday=\{user\?\.birthday/);
assert.match(settings, /linkGithubIdentity/);
assert.match(settings, /GitHub Repository Connection/);

console.log("Auth onboarding contract verification passed.");
