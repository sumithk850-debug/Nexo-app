import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import Module from "node:module";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.GITHUB_APP_ID = "123456";
process.env.GITHUB_APP_PRIVATE_KEY = privateKey.export({ type: "pkcs1", format: "pem" }).toString();

const fetchCalls: Array<{ url: string; authorization: string | null }> = [];
const originalFetch = global.fetch;
const originalLoad = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function patchedLoad(request: unknown, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
global.fetch = (async (input, init) => {
  const headers = new Headers(init?.headers);
  fetchCalls.push({ url: String(input), authorization: headers.get("authorization") });
  return new Response(JSON.stringify({
    token: "ghs_test_installation_token",
    permissions: { contents: "write", metadata: "read" },
  }), { status: 201, headers: { "content-type": "application/json" } });
}) as typeof fetch;

async function run() {
  const { getGitHubWriteCapability, resolveGitHubCredential } = await import("../lib/githubApp.server");
  const write = await getGitHubWriteCapability({ installation_id: "987654", access_token: null });
  assert.equal(write.canWrite, true, "an installation with contents:write must enable legacy-user writes");
  assert.equal(write.source, "installation");
  const credential = await resolveGitHubCredential({ installation_id: "987654", access_token: null }, "write");
  assert.equal(credential.token, "ghs_test_installation_token");
  assert.equal(fetchCalls.length, 2, "installation tokens must be minted through GitHub's App installation endpoint");
  assert.ok(fetchCalls.every((call) => call.url.includes("/app/installations/987654/access_tokens")));
  assert.ok(fetchCalls.every((call) => call.authorization?.startsWith("Bearer ")));
  console.log("GitHub legacy upgrade local checks passed: App installation token and write capability assertions.");
}

run().finally(() => {
  global.fetch = originalFetch;
  (Module as unknown as { _load: (...args: unknown[]) => unknown })._load = originalLoad;
});
