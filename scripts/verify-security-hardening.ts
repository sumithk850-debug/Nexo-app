import assert from "node:assert/strict";

import { createOAuthState, verifyOAuthState } from "../lib/oauthState.server";

process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = "nexo-local-security-regression-key";

const userId = "11111111-2222-3333-4444-555555555555";
const state = createOAuthState(userId, "github");

assert.equal(
  verifyOAuthState(state, "github"),
  userId,
  "a signed OAuth state must recover only its original user and provider",
);
assert.equal(
  verifyOAuthState(state, "supabase"),
  null,
  "a signed state must not be reusable across integration providers",
);
assert.equal(
  verifyOAuthState(`${state}tampered`, "github"),
  null,
  "a modified OAuth state must be rejected before any protected token is stored",
);

console.log("Security hardening local checks passed: OAuth state integrity assertions.");
